import type { MetadataRoute } from "next";

/**
 * Crawling rules for the site.
 *
 * Everything is fair game except the Red Fern demo, which is a private client
 * preview: it already sits behind a house code, and this keeps it out of
 * search results even if the gate is ever lifted.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/red-fern", "/red-fern/", "/api/red-fern/"],
    },
  };
}
