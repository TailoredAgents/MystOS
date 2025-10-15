import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/metadata";
import { getOrderedAreas, getOrderedPages, getOrderedServices } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [];

  const pages = getOrderedPages().filter((page) => !page.draft);
  for (const page of pages) {
    const path = page.slug === "home" ? "/" : `/${page.slug}`;
    urls.push({ url: absoluteUrl(path), lastModified: now });
  }

  urls.push({ url: absoluteUrl("/services"), lastModified: now });
  getOrderedServices().forEach((service) => {
    urls.push({ url: absoluteUrl(`/services/${service.slug}`), lastModified: now });
  });

  urls.push({ url: absoluteUrl("/areas"), lastModified: now });
  getOrderedAreas().forEach((area) => {
    urls.push({ url: absoluteUrl(`/areas/${area.slug}`), lastModified: now });
  });

  return urls;
}