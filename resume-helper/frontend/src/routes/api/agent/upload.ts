import { createFileRoute } from "@tanstack/react-router";
import { proxyUploadToAgent } from "./-proxy";

export const Route = createFileRoute("/api/agent/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyUploadToAgent(request),
    },
  },
});
