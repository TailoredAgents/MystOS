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
import { QuoteBuilderSection } from "./components/QuoteBuilderSection";
import { ChatSection } from "./components/ChatSection";
import { TabNav, type TabNavItem } from "./components/TabNav";

const ADMIN_COOKIE = "myst-admin-session";
const CREW_COOKIE = "myst-crew-session";

export const metadata = { title: "Myst Team Console" };

export default async function TeamPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; q?: string; offset?: string; contactId?: string }>;
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
  const quoteContactId = typeof params?.contactId === "string" ? params.contactId : undefined;

  const flash = cookieStore.get("myst-flash")?.value ?? null;
  const flashError = cookieStore.get("myst-flash-error")?.value ?? null;
  const tabs: TabNavItem[] = [
    { id: "myday", label: "My Day", href: "/team?tab=myday", requires: "crew" },
    { id: "estimates", label: "Estimates", href: "/team?tab=estimates", requires: "owner" },
    { id: "quotes", label: "Quotes", href: "/team?tab=quotes", requires: "owner" },
    { id: "quote-builder", label: "Quote Builder", href: "/team?tab=quote-builder", requires: "crew" },
    { id: "chat", label: "Chat", href: "/team?tab=chat", requires: "owner" },
    { id: "pipeline", label: "Pipeline", href: "/team?tab=pipeline", requires: "owner" },
    { id: "contacts", label: "Contacts", href: "/team?tab=contacts", requires: "owner" },
    { id: "payments", label: "Payments", href: "/team?tab=payments", requires: "owner" },
    { id: "settings", label: "Settings", href: "/team?tab=settings" }
  ];
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0] ?? null;
  const activeRequirement = activeTab?.requires;
  const needsCrewLogin = activeRequirement === "crew" && !hasCrew && !hasOwner;
  const needsOwnerLogin = activeRequirement === "owner" && !hasOwner;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_50%)]" />
      <main className="relative mx-auto max-w-6xl space-y-6 px-4 py-8 sm:space-y-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary-700">
                Myst Team
              </span>
              <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">Team Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
                Monitor appointments, quotes, pipeline health, and contacts from a single polished workspace designed for your crew and office team.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-600 sm:justify-items-end sm:text-right">
              <span
                className={`inline-flex w-full items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium sm:w-auto ${
                  hasCrew ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                Crew {hasCrew ? "signed in" : "login required"}
              </span>
              <span
                className={`inline-flex w-full items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium sm:w-auto ${
                  hasOwner ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                Owner {hasOwner ? "access granted" : "login required"}
              </span>
            </div>
          </div>
          <div className="mt-6">
            <TabNav items={tabs} activeId={tab} hasOwner={hasOwner} hasCrew={hasCrew} />
          </div>
        </header>

        {flash ? (
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 text-sm text-emerald-700 shadow-sm shadow-emerald-100">
            {flash}
          </div>
        ) : null}
        {flashError ? (
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-4 text-sm text-rose-700 shadow-sm shadow-rose-100">
            {flashError}
          </div>
        ) : null}

        {needsCrewLogin ? (
          <section className="max-w-md rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60">
            <CrewLoginForm redirectTo={`/team?tab=${encodeURIComponent(tab)}`} />
          </section>
        ) : needsOwnerLogin ? (
          <section className="max-w-md rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60">
            <AdminLoginForm redirectTo={`/team?tab=${encodeURIComponent(tab)}`} />
          </section>
        ) : null}

        {tab === "myday" && (hasCrew || hasOwner) ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading My Day
              </div>
            }
          >
            <MyDaySection />
          </React.Suspense>
        ) : null}

        {tab === "quote-builder" && (hasCrew || hasOwner) ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading Quote Builder
              </div>
            }
          >
            <QuoteBuilderSection initialContactId={quoteContactId} />
          </React.Suspense>
        ) : null}

        {tab === "chat" && hasOwner ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading chat
              </div>
            }
          >
            <ChatSection />
          </React.Suspense>
        ) : null}

        {tab === "estimates" && hasOwner ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading Estimates
              </div>
            }
          >
            <EstimatesSection />
          </React.Suspense>
        ) : null}

        {tab === "quotes" && hasOwner ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading Quotes
              </div>
            }
          >
            <QuotesSection />
          </React.Suspense>
        ) : null}

        {tab === "pipeline" && hasOwner ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading pipeline
              </div>
            }
          >
            <PipelineSection />
          </React.Suspense>
        ) : null}

        {tab === "contacts" && hasOwner ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading contacts
              </div>
            }
          >
            <ContactsSection search={contactsQuery} offset={contactsOffset} />
          </React.Suspense>
        ) : null}

        {tab === "payments" && hasOwner ? (
          <React.Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-sm text-slate-500 shadow-lg shadow-slate-200/50">
                Loading Payments
              </div>
            }
          >
            <PaymentsSection />
          </React.Suspense>
        ) : null}

        {tab === "settings" ? (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 shadow-lg shadow-slate-200/60">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Sessions</h2>
              <div className="flex flex-wrap gap-3">
                <form action={logoutCrew}>
                  <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800">
                    Log out crew
                  </button>
                </form>
                <form action={logoutOwner}>
                  <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800">
                    Log out owner
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}





