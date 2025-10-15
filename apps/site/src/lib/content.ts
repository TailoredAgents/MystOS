import { allAreas, allPages, allServices, type Area, type Page, type Service } from "contentlayer/generated";

export function getPageBySlug(slug: string): Page | undefined {
  return allPages.find((page) => page.slug === slug && !page.draft);
}

export function getServiceBySlug(slug: string): Service | undefined {
  return allServices.find((service) => service.slug === slug);
}

export function getAreaBySlug(slug: string): Area | undefined {
  return allAreas.find((area) => area.slug === slug);
}

export function getAreaIntro(): Area | undefined {
  return getAreaBySlug("index");
}

export function getOrderedPages(): Page[] {
  return [...allPages.filter((page) => !page.draft)].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getOrderedServices(): Service[] {
  return [...allServices].sort((a, b) => a.title.localeCompare(b.title));
}

export function getOrderedAreas(): Area[] {
  return allAreas
    .filter((area) => area.slug !== "index")
    .sort((a, b) => a.title.localeCompare(b.title));
}

