import type { Metadata } from "next";
import { getAreaBySlug, getPageBySlug, getServiceBySlug } from "./content";

const fallbackTitle = "Myst Pressure Washing";
const fallbackDescription =
  "Premium soft-wash and pressure washing across North Metro Atlanta. Schedule an on-site estimate and get spotless results backed by our make-it-right guarantee.";

const configuredSiteUrl = process.env["NEXT_PUBLIC_SITE_URL"]?.trim();
const normalizedSiteUrl = configuredSiteUrl && /^https?:\/\//.test(configuredSiteUrl)
  ? configuredSiteUrl.replace(/\/+$/u, "")
  : "https://myst.pressurewashing";

export const siteUrl = normalizedSiteUrl;

export function absoluteUrl(path: string): string {
  if (!path) {
    return siteUrl;
  }

  if (/^https?:/i.test(path)) {
    return path;
  }

  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${trimmed}`;
}

export function createPageMetadata(slug: string): Metadata {
  const page = getPageBySlug(slug);
  const title = page?.title ?? fallbackTitle;
  const description = page?.description ?? fallbackDescription;
  const path = slug === "home" ? "/" : `/${slug}`;
  const image = page?.heroImage ? absoluteUrl(page.heroImage) : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      images: image ? [{ url: image }] : undefined,
      type: "website"
    },
    alternates: {
      canonical: absoluteUrl(path)
    }
  };
}

export function createServiceMetadata(slug: string): Metadata {
  const service = getServiceBySlug(slug);
  if (!service) {
    return {
      title: fallbackTitle,
      description: fallbackDescription
    };
  }

  const description = service.short ?? fallbackDescription;
  const image = service.heroImage ? absoluteUrl(service.heroImage) : undefined;
  const path = `/services/${service.slug}`;

  return {
    title: `${service.title} | Myst Pressure Washing`,
    description,
    openGraph: {
      title: service.title,
      description,
      url: absoluteUrl(path),
      images: image ? [{ url: image }] : undefined,
      type: "article"
    },
    alternates: {
      canonical: absoluteUrl(path)
    }
  };
}

export function createAreaMetadata(slug: string): Metadata {
  const area = getAreaBySlug(slug);
  if (!area) {
    return {
      title: fallbackTitle,
      description: fallbackDescription
    };
  }

  const isIndex = area.slug === "index";
  const path = isIndex ? "/areas" : `/areas/${area.slug}`;
  const description = area.description ?? fallbackDescription;
  const title = isIndex ? "Myst Service Areas" : `${area.title} | Myst Service Area`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      type: "article"
    },
    alternates: {
      canonical: absoluteUrl(path)
    }
  };
}
