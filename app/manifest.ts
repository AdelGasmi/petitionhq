import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.name,
    description: BRAND.shortDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      // The SVG is rendered crisp at any size by all modern browsers/PWAs.
      // Add PNG fallbacks (192/512) later if iOS install-prompts need them.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    categories: ["legal", "business", "productivity"],
    lang: "en-US",
    orientation: "portrait",
  };
}
