import { createFileRoute } from "@tanstack/react-router";
import { proxyToAgent } from "./-proxy";

export const Route = createFileRoute("/api/agent/coverage")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyToAgent(request, "/analyze/coverage"),
    },
  },
});
