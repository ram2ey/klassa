import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klassa School Administration",
    short_name: "Klassa",
    description: "Secure school records and administration.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ffffff",
  };
}
