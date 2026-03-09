import { createFileRoute } from "@tanstack/react-router";
import { AIModelType, AI_MODEL_CONFIGS } from "@/config/ai";

function getUpstreamErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const obj = payload as Record<string, unknown>;
  const direct = obj.error ?? obj.message ?? obj.detail;

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

function extractContentFromJsonPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const obj = payload as Record<string, unknown>;
  const choices = obj.choices;

  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0] as Record<string, unknown>;

    const message = firstChoice.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === "string" && message.content.trim()) {
      return message.content;
    }

    const delta = firstChoice.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta.content === "string" && delta.content.trim()) {
      return delta.content;
    }
  }

  if (typeof obj.output_text === "string" && obj.output_text.trim()) {
    return obj.output_text;
  }

  return null;
}

function extractContentFromSSELine(rawLine: string): string | null {
  const line = rawLine.trim();
  if (!line || !line.startsWith("data:")) return null;

  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return null;

  try {
    const json = JSON.parse(data) as Record<string, unknown>;
    return extractContentFromJsonPayload(json);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/polish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { apiKey, model, content, modelType, apiEndpoint } = body as {
            apiKey: string;
            model: string;
            content: string;
            modelType: AIModelType;
            apiEndpoint?: string;
          };

          const modelConfig = AI_MODEL_CONFIGS[modelType as AIModelType];
          if (!modelConfig) {
            throw new Error("Invalid model type");
          }

          const response = await fetch(modelConfig.url(apiEndpoint), {
            method: "POST",
            headers: modelConfig.headers(apiKey),
            body: JSON.stringify({
              model: modelConfig.requiresModelId ? model : modelConfig.defaultModel,
              messages: [
                {
                  role: "system",
                  content: `你是一个专业的简历优化助手。请帮助优化以下 Markdown 格式的文本，使其更加专业和有吸引力。

              优化原则：
              1. 使用更专业的词汇和表达方式
              2. 突出关键成就和技能
              3. 保持简洁清晰
              4. 使用主动语气
              5. 保持原有信息的完整性
              6. 严格保留原有的 Markdown 格式结构（列表项保持为列表项，加粗保持加粗等）

              请直接返回优化后的 Markdown 文本，不要包含任何解释或其他内容。`
                },
                {
                  role: "user",
                  content
                }
              ],
              stream: true
            })
          });

          if (!response.ok) {
            let message = "Failed to polish content";
            const rawError = await response.text();
            if (rawError.trim()) {
              try {
                const upstreamError = JSON.parse(rawError);
                message = getUpstreamErrorMessage(upstreamError) || message;
              } catch {
                message = rawError.slice(0, 300);
              }
            }
            return Response.json({ error: message }, { status: response.status });
          }

          if (!response.body) {
            return Response.json({ error: "No response body" }, { status: 502 });
          }

          const upstreamContentType =
            response.headers.get("content-type")?.toLowerCase() || "";

          // Some providers ignore stream=true and return full JSON payload directly.
          if (upstreamContentType.includes("application/json")) {
            const payload = await response.json();
            const contentText = extractContentFromJsonPayload(payload);
            if (!contentText) {
              return Response.json(
                { error: "Model returned empty polish content" },
                { status: 502 }
              );
            }
            return new Response(contentText, {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
              },
            });
          }

          // If upstream is not SSE, pass through text stream directly.
          if (!upstreamContentType.includes("text/event-stream")) {
            return new Response(response.body, {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
              },
            });
          }

          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const reader = response.body!.getReader();
              const decoder = new TextDecoder();
              let buffer = "";

              const pushLine = (line: string) => {
                const content = extractContentFromSSELine(line);
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              };

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() || "";

                  for (const line of lines) {
                    pushLine(line);
                  }
                }

                const rest = buffer + decoder.decode();
                if (rest.trim()) {
                  pushLine(rest);
                }

                controller.close();
              } catch (error) {
                console.error("Stream reading error:", error);
                controller.error(error);
              }
            }
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache",
            }
          });
        } catch (error) {
          console.error("Polish error:", error);
          return Response.json({ error: "Failed to polish content" }, { status: 500 });
        }
      }
    }
  }
});
