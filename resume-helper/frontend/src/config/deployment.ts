function normalizeUrl(value: string | null | undefined): string {
  return (value || "").trim().replace(/\/+$/, "");
}

function inferProtocol(hostOrUrl: string): "http" | "https" {
  const normalized = hostOrUrl.toLowerCase();
  if (
    normalized.startsWith("localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("0.0.0.0")
  ) {
    return "http";
  }

  return "https";
}

const rawLocalConfigFlag = import.meta.env.VITE_ENABLE_LOCAL_CONFIG;

export const LOCAL_CONFIG_ENABLED =
  import.meta.env.DEV || rawLocalConfigFlag === "true";

export function isServerLocalConfigEnabled(): boolean {
  if (LOCAL_CONFIG_ENABLED) return true;
  if (typeof process === "undefined") return false;
  return process.env?.ENABLE_LOCAL_CONFIG_API === "true";
}

export function resolveAgentApiUrl(): string {
  const directUrl = normalizeUrl(import.meta.env.VITE_AGENT_API_URL);
  if (directUrl) return directUrl;

  const hostPort =
    typeof process !== "undefined"
      ? normalizeUrl(process.env?.AGENT_API_HOSTPORT)
      : "";

  if (hostPort) {
    if (hostPort.startsWith("http://") || hostPort.startsWith("https://")) {
      return hostPort;
    }
    return `${inferProtocol(hostPort)}://${hostPort}`;
  }

  return "http://localhost:8000";
}
