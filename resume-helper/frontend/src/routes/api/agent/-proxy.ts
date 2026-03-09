/**
 * Agent代理路由工具函数
 * 统一转发请求到FastAPI后端
 */

import { resolveAgentApiUrl } from "@/config/deployment";

async function safeReadRequestJson(
  request: Request
): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorDetail(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  }
  return `Agent request failed (${status})`;
}

function toErrorResponse(payload: unknown, status: number): Response {
  const detail = extractErrorDetail(payload, status);
  return Response.json(
    {
      status: "error",
      message: detail,
      detail,
      code: status,
    },
    // Keep proxy response 200 so frontend can handle app-level errors
    // without browser "Failed to load resource" noise.
    { status: 200 }
  );
}

export async function proxyToAgent(
  request: Request,
  path: string
): Promise<Response> {
  const body = await safeReadRequestJson(request);
  if (!body) {
    return Response.json(
      {
        status: "error",
        message: "Invalid JSON request body",
        detail: "Request payload must be valid JSON",
        code: 400,
      },
      { status: 200 }
    );
  }
  const targetUrl = `${resolveAgentApiUrl()}/api/v1${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await safeReadJson(response);
    if (!response.ok) {
      return toErrorResponse(data, response.status);
    }

    if (data && typeof data === "object") {
      return Response.json(data, { status: 200 });
    }
    return Response.json({ status: "ok", data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown");
    console.warn(`Agent proxy error [${path}]: ${message}`);
    return Response.json(
      {
        status: "error",
        message: "Agent后端连接失败，请确认后端已启动",
        detail: "Agent backend unreachable",
        code: 502,
      },
      { status: 200 }
    );
  }
}

export async function proxyUploadToAgent(
  request: Request
): Promise<Response> {
  const targetUrl = `${resolveAgentApiUrl()}/api/v1/upload`;

  try {
    // 直接转发FormData
    const formData = await request.formData();
    const response = await fetch(targetUrl, {
      method: "POST",
      body: formData,
    });

    const data = await safeReadJson(response);
    if (!response.ok) {
      return toErrorResponse(data, response.status);
    }

    if (data && typeof data === "object") {
      return Response.json(data, { status: 200 });
    }
    return Response.json({ status: "ok", data }, { status: 200 });
  } catch (error) {
    console.error("Agent upload proxy error:", error);
    return Response.json(
      {
        status: "error",
        message: "Agent后端连接失败",
        detail: "Agent backend unreachable",
        code: 502,
      },
      { status: 200 }
    );
  }
}
