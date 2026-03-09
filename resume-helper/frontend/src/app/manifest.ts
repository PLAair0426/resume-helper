import type { MetadataRoute } from "next";

export const runtime = "edge";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "简历小助手",
    short_name: "简历小助手",
    description: "AI 简历编辑与优化工具",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
