"""Unified LLM service based on LiteLLM."""

import json
import logging
import re
from typing import Any, Optional

from litellm import acompletion

from backend.core.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Unified LLM completion interface with provider fallback."""

    PROVIDER_MODEL_MAP = {
        "openai": lambda cfg: cfg.openai_model,
        "anthropic": lambda cfg: cfg.anthropic_model,
        "deepseek": lambda cfg: cfg.deepseek_model,
    }

    PROVIDER_KEY_MAP = {
        "openai": lambda cfg: cfg.openai_api_key,
        "anthropic": lambda cfg: cfg.anthropic_api_key,
        "deepseek": lambda cfg: cfg.deepseek_api_key,
    }

    def __init__(self):
        self.config = settings.llm

    def _get_model_name(self, provider: str) -> str:
        getter = self.PROVIDER_MODEL_MAP.get(provider)
        if not getter:
            raise ValueError(f"Unknown provider: {provider}")
        return getter(self.config)

    def _get_api_key(self, provider: str) -> Optional[str]:
        getter = self.PROVIDER_KEY_MAP.get(provider)
        return getter(self.config) if getter else None

    @staticmethod
    def _format_exception(exc: Exception) -> str:
        """Generate stable, debuggable error text even when str(exc) is empty/None."""
        message = str(exc).strip()
        if message.lower() in {"none", "null"}:
            message = ""
        parts = [f"{exc.__class__.__name__}: {message}" if message else exc.__class__.__name__]

        for attr in ("status_code", "code", "type"):
            value = getattr(exc, attr, None)
            if value is not None:
                parts.append(f"{attr}={value}")

        for attr in ("message", "detail", "body"):
            value = getattr(exc, attr, None)
            if isinstance(value, str) and value.strip():
                parts.append(f"{attr}={value.strip()}")

        return " | ".join(parts)

    @staticmethod
    def _to_text_content(content: Any) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        chunks.append(text)
                elif isinstance(item, str):
                    chunks.append(item)
            return "".join(chunks)

        return "" if content is None else str(content)

    @staticmethod
    def _extract_json_candidate(content: str) -> Optional[Any]:
        """Try multiple strategies to parse JSON from model output."""
        if not isinstance(content, str):
            return None

        text = content.strip()
        if not text:
            return None

        candidates: list[str] = [text]

        # Sometimes model prefixes with `json` before payload.
        if text.lower().startswith("json"):
            trimmed = text[4:].strip(" \n\r\t:：")
            if trimmed:
                candidates.append(trimmed)

        # Capture fenced code blocks.
        for m in re.finditer(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE):
            block = (m.group(1) or "").strip()
            if block:
                candidates.append(block)

        # Capture best-effort object / array region.
        obj_start = text.find("{")
        obj_end = text.rfind("}") + 1
        if obj_start >= 0 and obj_end > obj_start:
            candidates.append(text[obj_start:obj_end].strip())

        arr_start = text.find("[")
        arr_end = text.rfind("]") + 1
        if arr_start >= 0 and arr_end > arr_start:
            candidates.append(text[arr_start:arr_end].strip())

        seen: set[str] = set()
        for candidate in candidates:
            normalized = candidate.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            try:
                return json.loads(normalized)
            except json.JSONDecodeError:
                continue
        return None

    async def complete(
        self,
        messages: list[dict],
        provider: Optional[str] = None,
        json_schema: Optional[dict] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        api_endpoint: Optional[str] = None,
    ) -> dict:
        """
        Call LLM with optional provider fallback.

        Returns:
            {"content": str, "provider": str, "model": str, "usage": dict}
        """
        normalized_provider = provider.lower().strip() if provider else None

        # If explicit provider+api_key are supplied by frontend, use them directly.
        if api_key and normalized_provider:
            try:
                return await self._call_llm(
                    provider=normalized_provider,
                    model_name=model or self._get_model_name(normalized_provider),
                    messages=messages,
                    json_schema=json_schema,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    api_key=api_key,
                    api_endpoint=api_endpoint,
                )
            except Exception as exc:
                detail = self._format_exception(exc)
                raise RuntimeError(
                    f"LLM call failed for provider '{normalized_provider}': {detail}"
                ) from exc

        providers = [normalized_provider] if normalized_provider else self.config.fallback_order
        last_error: Optional[Exception] = None
        attempted_providers: list[str] = []
        skipped_providers: list[str] = []
        provider_errors: list[str] = []

        for p in providers:
            effective_key = api_key if api_key else self._get_api_key(p)
            if not effective_key:
                skipped_providers.append(p)
                logger.debug("Skipping %s: no API key configured", p)
                continue

            try:
                attempted_providers.append(p)
                return await self._call_llm(
                    provider=p,
                    model_name=model or self._get_model_name(p),
                    messages=messages,
                    json_schema=json_schema,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    api_key=effective_key,
                    api_endpoint=api_endpoint,
                )
            except Exception as exc:
                last_error = exc
                detail = self._format_exception(exc)
                provider_errors.append(f"{p}: {detail}")
                logger.warning("LLM call failed for %s: %s", p, detail)
                continue

        if not attempted_providers:
            if normalized_provider:
                raise RuntimeError(f"No API key available for provider '{normalized_provider}'.")
            raise RuntimeError(
                "No API key available for fallback providers: "
                + ", ".join(skipped_providers)
            )

        if not provider_errors:
            # Should not happen, but keep fallback message deterministic.
            fallback_error = "unknown error"
        else:
            fallback_error = " | ".join(provider_errors)

        if last_error is None:
            raise RuntimeError(
                "All LLM providers failed. Attempted: "
                + ", ".join(attempted_providers)
                + f". Errors: {fallback_error}"
            )

        raise RuntimeError(
            "All LLM providers failed. Attempted: "
            + ", ".join(attempted_providers)
            + f". Errors: {fallback_error}"
        ) from last_error

    async def _call_llm(
        self,
        provider: str,
        model_name: str,
        messages: list[dict],
        json_schema: Optional[dict],
        temperature: float,
        max_tokens: int,
        api_key: str,
        api_endpoint: Optional[str] = None,
    ) -> dict:
        """Run one provider call."""
        litellm_model = model_name if "/" in model_name else f"{provider}/{model_name}"

        kwargs: dict[str, Any] = {
            "model": litellm_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "api_key": api_key,
            "timeout": self.config.timeout,
            # Let LiteLLM strip provider/model-specific unsupported params
            # (e.g. some codex/gpt-5 variants reject custom temperature).
            "drop_params": True,
        }

        if api_endpoint and api_endpoint.strip():
            kwargs["api_base"] = api_endpoint.strip()

        has_schema = isinstance(json_schema, dict) and len(json_schema) > 0
        if has_schema and provider == "openai":
            kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "output", "schema": json_schema, "strict": True},
            }
        elif has_schema:
            schema_str = json.dumps(json_schema, ensure_ascii=False, indent=2)
            patched_messages = messages.copy()
            if patched_messages:
                patched_messages[0] = patched_messages[0].copy()
                patched_messages[0]["content"] = (
                    str(patched_messages[0].get("content", ""))
                    + f"\n\nPlease output strictly following this JSON Schema:\n```json\n{schema_str}\n```"
                )
            kwargs["messages"] = patched_messages

        response = await acompletion(**kwargs)
        raw_content = response.choices[0].message.content
        content = self._to_text_content(raw_content)

        if not content:
            raise ValueError("LLM returned empty content")

        usage = getattr(response, "usage", None)

        return {
            "content": content,
            "provider": provider,
            "model": model_name,
            "usage": {
                "prompt_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
                "completion_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
                "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
            },
        }

    async def complete_json(
        self,
        messages: list[dict],
        json_schema: dict,
        provider: Optional[str] = None,
        temperature: float = 0.1,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        api_endpoint: Optional[str] = None,
    ) -> dict:
        """Call LLM and parse JSON output."""
        result = await self.complete(
            messages=messages,
            provider=provider,
            json_schema=json_schema,
            temperature=temperature,
            api_key=api_key,
            model=model,
            api_endpoint=api_endpoint,
        )

        content = result.get("content", "")
        parsed = self._extract_json_candidate(content)
        if parsed is not None:
            result["parsed"] = parsed
            return result

        # Retry once with a JSON-fix pass to recover non-JSON model outputs.
        repair_messages: list[dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "You are a JSON formatter. Convert the given text into strictly valid JSON. "
                    "Output JSON only. Do not include markdown fences or extra commentary."
                ),
            },
            {"role": "user", "content": content},
        ]
        if isinstance(json_schema, dict) and json_schema:
            schema_str = json.dumps(json_schema, ensure_ascii=False, indent=2)
            repair_messages[0]["content"] += (
                f"\n\nTarget JSON Schema:\n```json\n{schema_str}\n```"
            )

        repaired = await self.complete(
            messages=repair_messages,
            provider=provider,
            json_schema=json_schema,
            temperature=0.0,
            api_key=api_key,
            model=model,
            api_endpoint=api_endpoint,
        )
        repaired_content = repaired.get("content", "")
        parsed = self._extract_json_candidate(repaired_content)
        if parsed is not None:
            result["parsed"] = parsed
            result["repair_applied"] = True
            return result

        preview = content[:240].replace("\n", "\\n")
        raise ValueError(
            "Failed to parse LLM JSON output after repair retry. "
            f"First output preview: {preview}"
        )


llm_service = LLMService()
