import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
	const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.getmidiflow.com").replace(/\/$/, "");
	return {
		rules: {
			userAgent: "*",
			allow: ["/", "/features", "/pricing", "/download", "/support", "/voice-to-midi", "/song-pack-generator"],
			disallow: ["/admin", "/api/", "/dashboard", "/projects", "/history", "/downloads", "/favorites", "/licenses", "/billing", "/settings", "/profile", "/api-keys", "/login", "/signup"],
		},
		sitemap: `${base}/sitemap.xml`,
	};
}
