import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "MidiFlow", short_name: "MidiFlow", description: "AI-assisted MIDI generation for artists and producers.", start_url: "/", display: "standalone", background_color: "#000000", theme_color: "#000000" }; }
