import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

const withSelectorShimPath = fileURLToPath(
  new URL("./src/shims/use-sync-external-store-with-selector.ts", import.meta.url)
);

export default defineConfig({
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      "use-sync-external-store/shim/with-selector": withSelectorShimPath
    }
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "routes"
      }
    }),
    viteReact()
  ]
});
