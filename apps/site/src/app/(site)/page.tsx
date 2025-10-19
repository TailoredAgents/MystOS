import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { allAreas, allPages, allServices } from "contentlayer/generated";
import { notFound } from "next/navigation";
import { BeforeAfterSlider, Button, Card, Section, Stat, Testimonials } from "@myst-os/ui";
import { HeroV2 } from "@/components/HeroV2";
import { LeadForm } from "@/components/LeadForm";
import { MdxContent } from "@/components/MdxContent";
import { StickyCtaBar } from "@/components/StickyCtaBar";
import { createPageMetadata } from "@/lib/metadata";

const beforeImage = "/images/gallery/before.jpg";
const afterImage = "/images/gallery/after.png";

const resultTiles = [
  {
    title: "Driveway Restoration",
    description: "Layered rust, clay, and tire marks lifted in a single soft-wash pass.",
    beforeImage: "/images/gallery/before.jpg",
    afterImage: "/images/gallery/after.png"
  },
  {
    title: "Whole-Home Glow-up",
    description: "Stone facade, trim, and copper accents brightened in one visit.",
    beforeImage: "/images/gallery/home-before.jpg",
    afterImage: "/images/gallery/home-after.png"
  },
  {
    title: "Commercial Exterior Refresh",
    description: "Audi Atlanta&apos;s service entry refreshed overnight without disrupting business hours.",
    afterImage: "/images/gallery/commercial-after.png"
  }
];

const testimonials = [
  {
    quote: "Everything looks brand new again and the crew was respectful of our landscaping.",
    name: "Brianna S.",
    location: "Woodstock"
  },
  {
    quote: "Professional from quote to cleanup. Roof streaks vanished before lunch.",
    name: "Marcus T.",
    location: "Canton"
  },
  {
    quote: "Communication was outstanding. Text updates and an immaculate driveway.",
    name: "Alyssa K.",
    location: "Roswell"
  }
];

const stats = [
  { label: "Projects", value: "1,200+", secondary: "Completed across North Metro Atlanta" },
  { label: "Estimator Dispatch", value: "< 24 hrs", secondary: "Average onsite scheduling time" },
  { label: "Guarantee", value: "Make-It-Right", secondary: "We fix issues within 48 hours" }
];

export const metadata = createPageMetadata("home");

export default function HomePage() {
  const home = allPages.find((page) => page.slug === "home");
  if (!home) {
    notFound();
  }

  const services = allServices.sort((a, b) => a.title.localeCompare(b.title));
  const areas = allAreas.filter((area) => area.slug !== "index").sort((a, b) => a.title.localeCompare(b.title));
  const leadFormServices = [
    ...services.map((service) => ({
      slug: service.slug,
      title: service.title,
      description: service.short ?? undefined
    })),
    {
      slug: "commercial-services",
      title: "Commercial Services",
      description: "Storefronts, office parks, HOA amenities, and shared spaces"
    }
  ];

  return (
    <div className="relative flex flex-col gap-16 pb-24">
      <Section className="pt-10 md:pt-12">
        <HeroV2 variant="lean" />
      </Section>
      <Section className="relative" containerClassName="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-headline text-primary-800">Results that speak for themselves</h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              A quick look at recent Myst projects across driveways, facades, and landscaping-friendly rinses.
            </p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Finished in the last 30 days
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {resultTiles.map((tile) => (
            <article
              key={tile.title}
              className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-float"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={tile.afterImage}
                  alt={`${tile.title} after Myst exterior cleaning`}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-105"
                  sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                  priority={false}
                />
                {tile.beforeImage ? (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden transition duration-700 group-hover:translate-x-1"
                      style={{ clipPath: "inset(0 52% 0 0)" }}
                    >
                      <Image
                        src={tile.beforeImage}
                        alt={`${tile.title} before Myst exterior cleaning`}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
                        priority={false}
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 left-[48%] w-px bg-white/80 shadow-[0_0_12px_rgba(15,23,42,0.35)]" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white">
                      <span>Before</span>
                    </div>
                    <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary-700/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white">
                      <span>After</span>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="space-y-2 px-6 py-5">
                <h3 className="text-lg font-semibold text-primary-900">{tile.title}</h3>
                <p className="text-sm text-neutral-600">{tile.description}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section containerClassName="gap-10">
        <div className="grid gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </div>
        <div className="grid gap-8">
          <div className="rounded-xl border border-neutral-300/50 bg-white p-8 shadow-soft">
            <MdxContent code={home.body.code} />
          </div>
          <div id="schedule-estimate">
            <Suspense
              fallback={
                <div className="rounded-xl border border-neutral-300/50 bg-white p-8 text-sm text-neutral-600 shadow-soft">
                  Loading scheduler...
                </div>
              }
            >
              <LeadForm services={leadFormServices} />
            </Suspense>
          </div>
        </div>
      </Section>

      <Section className="mt-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-headline text-primary-800">Services tailored to every surface</h2>
            <p className="mt-3 max-w-2xl text-body text-neutral-600">
              From whole-home soft washing to detailed gutter and deck care, Myst builds each visit around the way your property lives and weathers Georgia seasons.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/services">Explore Services</Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <Card key={service.slug} className="flex h-full flex-col gap-4">
              <div>
                <h3 className="text-xl font-semibold text-primary-800">{service.title}</h3>
                {service.short ? (
                  <p className="mt-2 text-body text-neutral-600">{service.short}</p>
                ) : null}
              </div>
              <Button variant="ghost" asChild className="mt-auto w-fit px-0 text-accent-600">
                <Link href={`/services/${service.slug}`}>Learn more{" ->"}</Link>
              </Button>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10">
          <div>
            <h2 className="font-display text-headline text-primary-800">See the Myst difference</h2>
            <p className="mt-3 text-body text-neutral-600">
              Real before-and-after transformations from North Metro homes. Slide to compare the restore in seconds.
            </p>
            <ul className="mt-5 space-y-2 text-body text-neutral-600">
              <li>- Soft-wash chemistry keeps siding and paint protected.</li>
              <li>- Pro-grade surface cleaners leave uniform finishes.</li>
              <li>- Detailed rinse downs keep landscaping happy.</li>
            </ul>
          </div>
          <BeforeAfterSlider beforeImage={beforeImage} afterImage={afterImage} alt="Myst exterior cleaning transformation" />
        </div>
      </Section>

      <Section>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-headline text-primary-800">Homeowners rave about Myst</h2>
            <p className="mt-2 max-w-2xl text-body text-neutral-600">
              Thousands of spotless finishes, verified five-star reviews, and a make-it-right guarantee on every project.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/reviews">Read reviews</Link>
          </Button>
        </div>
        <Testimonials items={testimonials} />
      </Section>

      <Section>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-headline text-primary-800">Serving North Metro communities</h2>
            <p className="mt-2 text-body text-neutral-600">
              Core coverage includes Woodstock, Towne Lake, Canton, Roswell, Alpharetta, and beyond. Extended travel options available up to 30 miles.
            </p>
          </div>
          <Button asChild>
            <Link href="/areas">View all areas</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.slice(0, 6).map((area) => (
            <Card key={area.slug} className="flex h-full flex-col gap-3">
              <h3 className="text-lg font-semibold text-primary-800">{area.title}</h3>
              {area.city ? <p className="text-sm text-neutral-500">{area.city}</p> : null}
              <Button variant="ghost" asChild className="mt-auto w-fit px-0 text-accent-600">
                <Link href={`/areas/${area.slug}`}>Explore area{" ->"}</Link>
              </Button>
            </Card>
          ))}
        </div>
      </Section>
      <StickyCtaBar />
    </div>
  );
}


