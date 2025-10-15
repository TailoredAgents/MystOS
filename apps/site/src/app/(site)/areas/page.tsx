import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Section } from "@myst-os/ui";
import { MdxContent } from "@/components/MdxContent";
import { getAreaIntro, getOrderedAreas } from "@/lib/content";
import { createAreaMetadata } from "@/lib/metadata";

export const metadata = createAreaMetadata("index");

export default function AreasIndex() {
  const intro = getAreaIntro();
  const areas = getOrderedAreas();

  if (!intro || !areas.length) {
    notFound();
  }

  return (
    <Section>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-3">
          <Badge tone="highlight">Core Coverage</Badge>
          <h1 className="font-display text-display text-primary-800">North Metro Atlanta service areas</h1>
          {intro.description ? (
            <p className="text-body text-neutral-600">{intro.description}</p>
          ) : null}
        </header>
        <Card tone="outline" className="space-y-4">
          <MdxContent code={intro.body.code} />
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {areas.map((area) => (
            <Card key={area.slug} className="flex h-full flex-col gap-3">
              <div>
                <h2 className="text-xl font-semibold text-primary-800">{area.title}</h2>
                {area.city ? <p className="text-sm text-neutral-500">{area.city}</p> : null}
              </div>
              <Button variant="ghost" asChild className="mt-auto w-fit px-0 text-accent-600">
                <Link href={`/areas/${area.slug}`}>View details{" ->"}</Link>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}

