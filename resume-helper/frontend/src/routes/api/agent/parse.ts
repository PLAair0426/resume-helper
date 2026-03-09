import { createFileRoute } from "@tanstack/react-router";

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
  return `Parse request failed (${status})`;
}

export const Route = createFileRoute("/api/agent/parse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        const sessionId = body.session_id;
        const { session_id: _ignored, ...credentials } = body as Record<string, unknown>;
        if (!sessionId) {
          return Response.json({ status: "error", message: "缺少session_id" }, { status: 400 });
        }

        const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || "http://localhost:8000";
        try {
          const response = await fetch(`${AGENT_API_URL}/api/v1/parse/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials),
          });
          const data = await safeReadJson(response);
          if (!response.ok) {
            const detail = extractErrorDetail(data, response.status);
            return Response.json(
              { status: "error", message: detail, detail, code: response.status },
              { status: 200 }
            );
          }

          if (data && typeof data === "object") {
            return Response.json(data, { status: 200 });
          }
          return Response.json({ status: "ok", data }, { status: 200 });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error ?? "unknown");
          console.warn(`Agent parse proxy error: ${message}`);
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
      },
    },
  },
});
