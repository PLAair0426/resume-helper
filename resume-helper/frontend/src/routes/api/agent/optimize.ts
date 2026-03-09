import { createFileRoute } from "@tanstack/react-router";
import { proxyToAgent } from "./-proxy";

export const Route = createFileRoute("/api/agent/optimize")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyToAgent(request, "/optimize/content"),
    },
  },
});
