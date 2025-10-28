import React from "react";
import { cookies } from "next/headers";
import { AdminLoginForm } from "../admin/login/LoginForm";
import { CrewLoginForm } from "../crew/login/LoginForm";
import {
  logoutCrew,
  logoutOwner
} from "./actions";
import { MyDaySection } from "./components/MyDaySection";
import { EstimatesSection } from "./components/EstimatesSection";
import { QuotesSection } from "./components/QuotesSection";
import { PaymentsSection } from "./components/PaymentsSection";
import { ContactsSection } from "./components/ContactsSection";
import { PipelineSection } from "./components/PipelineSection";

const ADMIN_COOKIE = "myst-admin-session";
const CREW_COOKIE = "myst-crew-session";

function Tabs({ active, hasOwner, hasCrew }: { active: string; hasOwner: boolean; hasCrew: boolean }) {
  const mk = (tab: string, label: string, require?: "owner" | "crew") => {
    const disabled = (require === "owner" && !hasOwner) || (require === "crew" && !hasCrew);
    const href = `/team?tab=${encodeURIComponent(tab)}`;
    const cls = `rounded-md px-3 py-1 text-sm font-medium ${
      active === tab ? "bg-primary-50 text-primary-800 border border-primary-200" : "text-neutral-700 hover:bg-neutral-50 border border-transparent"
    } ${disabled ? "opacity-50 pointer-events-none" : ""}`;
    return (
      <a key={tab} href={href} className={cls}>
        {label}
      </a>
    );
  };

  return (
    <nav className="flex flex-wrap gap-2">
      {mk("myday", "My Day", "crew")}
      {mk("estimates", "Estimates", "owner")}
      {mk("quotes", "Quotes", "owner")}
      {mk("pipeline", "Pipeline", "owner")}
      {mk("contacts", "Contacts", "owner")}
      {mk("payments", "Payments", "owner")}
      {mk("settings", "Settings")}
    </nav>
  );
}

export const metadata = { title: "Myst Team Console" };

export default async function TeamPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; q?: string; offset?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const hasOwner = cookieStore.get(ADMIN_COOKIE)?.value ? true : false;
  const hasCrew = cookieStore.get(CREW_COOKIE)?.value ? true : false;

  const tab = params?.tab || (hasCrew && !hasOwner ? "myday" : "estimates");
  const contactsQuery = typeof params?.q === "string" ? params.q : undefined;
  let contactsOffset: number | undefined;
  if (typeof params?.offset === "string") {
    const parsed = Number(params.offset);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      contactsOffset = parsed;
    }
  }

  const flash = cookieStore.get("myst-flash")?.value ?? null;
  const flashError = cookieStore.get("myst-flash-error")?.value ?? null;
  if (flash) {
    cookieStore.set({ name: "myst-flash", value: "", path: "/", maxAge: 0 });
  }
  if (flashError) {
    cookieStore.set({ name: "myst-flash-error", value: "", path: "/", maxAge: 0 });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Myst Team</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-primary-900">Team Console</h1>
          <Tabs active={tab} hasOwner={hasOwner} hasCrew={hasCrew} />
        </div>
      </header>

      {flash ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash}</div>
      ) : null}
      {flashError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{flashError}</div>
      ) : null}

      {tab === "myday" && !hasCrew ? (
        <section className="max-w-md">
          <CrewLoginForm redirectTo="/team?tab=myday" />
        </section>
      ) : tab !== "myday" && !hasOwner ? (
        <section className="max-w-md">
          <AdminLoginForm redirectTo={`/team?tab=${encodeURIComponent(tab)}`} />
        </section>
      ) : null}

      {tab === "myday" && hasCrew ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading My Day</div>}>
          <MyDaySection />
        </React.Suspense>
      ) : null}

      {tab === "estimates" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Estimates</div>}>
          <EstimatesSection />
        </React.Suspense>
      ) : null}

      {tab === "quotes" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Quotes</div>}>
          <QuotesSection />
        </React.Suspense>
      ) : null}

      {tab === "pipeline" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading pipeline</div>}>
          <PipelineSection />
        </React.Suspense>
      ) : null}

      {tab === "contacts" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading contacts</div>}>
          <ContactsSection search={contactsQuery} offset={contactsOffset} />
        </React.Suspense>
      ) : null}

      {tab === "payments" && hasOwner ? (
        <React.Suspense fallback={<div className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Loading Payments</div>}>
          <PaymentsSection />
        </React.Suspense>
      ) : null}

      {tab === "settings" ? (
        <section className="space-y-4 text-sm text-neutral-700">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-primary-900">Sessions</h2>
            <div className="flex gap-2">
              <form action={logoutCrew}>
                <button className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700">Log out crew</button>
              </form>
              <form action={logoutOwner}>
                <button className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700">Log out owner</button>
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}


