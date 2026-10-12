import { getBaseUrl } from "@repo/utils";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: ["/"],
			disallow: ["/auth/", "/app/"],
		},
		sitemap: `${getBaseUrl()}/sitemap.xml`,
	};
}
