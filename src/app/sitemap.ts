import type { MetadataRoute } from "next";

const publicPages = [
	{ path: "/", priority: 1 },
	{ path: "/features", priority: 0.8 },
	{ path: "/pricing", priority: 0.8 },
	{ path: "/download", priority: 0.6 },
	{ path: "/support", priority: 0.6 },
	{ path: "/voice-to-midi", priority: 0.8 },
	{ path: "/song-pack-generator", priority: 0.8 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
	const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
	return publicPages.map(({ path, priority }) => ({
		url: `${base}${path}`,
		changeFrequency: "weekly",
		priority,
	}));
}
