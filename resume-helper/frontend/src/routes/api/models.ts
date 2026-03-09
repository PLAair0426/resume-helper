import { createFileRoute } from "@tanstack/react-router";

interface ModelsRequestBody {
  apiKey?: string;
  apiEndpoint?: string;
}

async function safeReadRequestBody(
  request: Request
): Promise<ModelsRequestBody | null> {
  const raw = await request.text();
  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as ModelsRequestBody;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeModelsUrl(apiEndpoint: string): string {
  let base = apiEndpoint.trim().replace(/\/+$/, "");

  if (base.endsWith("/chat/completions")) {
    base = base.slice(0, -"/chat/completions".length);
  }

  if (base.endsWith("/completions")) {
    base = base.slice(0, -"/completions".length);
  }

  if (base.endsWith("/models")) {
    return base;
  }

  return `${base}/models`;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const value = payload as Record<string, unknown>;
  const direct = value.error ?? value.message ?? value.detail;

  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  if (direct && typeof direct === "object") {
    const nested = direct as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message;
    }
  }

  return null;
}

function extractModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];

  const value = payload as Record<string, unknown>;
  const data = value.data;
  if (!Array.isArray(data)) return [];

  const ids = data
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const id = (item as Record<string, unknown>).id;
      return typeof id === "string" ? id.trim() : "";
    })
    .filter(Boolean);

  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await safeReadRequestBody(request);
          if (!body) {
            return Response.json(
              { status: "error", message: "Invalid JSON request body" },
              { status: 400 }
            );
          }

          const apiKey = body.apiKey?.trim() || "";
          const apiEndpoint = body.apiEndpoint?.trim() || "";

          if (!apiKey) {
            return Response.json(
              { status: "error", message: "API Key is required" },
              { status: 400 }
            );
          }

          if (!apiEndpoint) {
            return Response.json(
              { status: "error", message: "API endpoint is required" },
              { status: 400 }
            );
          }

          const modelsUrl = normalizeModelsUrl(apiEndpoint);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          const upstream = await fetch(modelsUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }).finally(() => {
            clearTimeout(timeoutId);
          });

          const raw = await upstream.text();
          let payload: unknown = {};
          if (raw.trim()) {
            try {
              payload = JSON.parse(raw);
            } catch {
              payload = { message: raw };
            }
          }

          if (!upstream.ok) {
            return Response.json(
              {
                status: "error",
                message:
                  extractErrorMessage(payload) ||
                  `Failed to fetch models: ${upstream.status}`,
              },
              { status: upstream.status }
            );
          }

          const models = extractModelIds(payload);
          return Response.json({ status: "ok", models });
        } catch (error) {
          const rawMessage =
            error instanceof Error ? error.message : String(error ?? "unknown");
          const errorCause =
            error && typeof error === "object"
              ? (error as { cause?: { code?: string; message?: string } }).cause
              : undefined;
          const causeHint = errorCause?.code || errorCause?.message || "";
          const message = [rawMessage, causeHint].filter(Boolean).join(" | ");

          const friendlyMessage = /abort|timeout/i.test(message)
            ? "Model endpoint connection timed out, please check BASE_URL/network"
            : `Failed to fetch model list: ${message}`;
          console.warn("Model list proxy error:", friendlyMessage);
          return Response.json(
            { status: "error", message: friendlyMessage },
            { status: 200 }
          );
        }
      },
    },
  },
});
