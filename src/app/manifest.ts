// Web app manifest — makes the site installable as a PWA. Next serves this at
// /manifest.webmanifest and auto-injects <link rel="manifest"> into <head>.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Federated Relief System",
    short_name: "Relief",
    description:
      "Cross-NGO disaster relief coordination — incidents, needs, and volunteer matching.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f8fc",
    theme_color: "#0891b2",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
