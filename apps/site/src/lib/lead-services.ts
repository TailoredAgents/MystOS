export type LeadServiceOption = {
  slug: string;
  title: string;
  description?: string;
};

export const DEFAULT_LEAD_SERVICE_OPTIONS: LeadServiceOption[] = [
  { slug: "house-wash", title: "Whole Home Soft Wash", description: "Siding, brick, and trim" },
  { slug: "driveway", title: "Driveway & Walkway", description: "Concrete, pavers, and pads" },
  { slug: "roof", title: "Roof Treatment", description: "Soft wash for shingles and tile" },
  { slug: "deck", title: "Deck & Patio", description: "Wood, composite, or stone surfaces" },
  { slug: "windows", title: "Exterior Windows", description: "Spot-free rinse and detailing" },
  { slug: "gutter", title: "Gutters & Downspouts", description: "Clear, flush, and brighten" }
];
