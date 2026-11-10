import type { MetadataRoute } from "next";

// The install file. Chrome offers to install the app from it; no service worker is needed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meat Ops",
    short_name: "Meat Ops",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
