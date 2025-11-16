"use client";

import { useState } from "react";
import { cn } from "@myst-os/ui";

interface ContextSummaryButtonProps {
  contactId?: string | null;
  quoteId?: string | null;
  appointmentId?: string | null;
  className?: string;
  label?: string;
}

export function ContextSummaryButton({
  contactId,
  quoteId,
  appointmentId,
  className,
  label = "AI summary"
}: ContextSummaryButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  if (!contactId) {
    return null;
  }

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("contactId", contactId);
      if (quoteId) params.set("quoteId", quoteId);
      if (appointmentId) params.set("appointmentId", appointmentId);
      const response = await fetch(`/api/insights/customer?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.summary) {
        throw new Error(payload?.error ?? "summary_failed");
      }
      setSummary(payload.summary as string);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to summarize";
      setError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("space-y-2 text-xs", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center rounded-md border border-primary-200 px-3 py-1 font-semibold text-primary-800 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Summarizing..." : label}
      </button>
      {error ? <p className="text-rose-600">{error}</p> : null}
      {summary ? (
        <p className="rounded-md border border-slate-200 bg-white/90 p-3 text-slate-700 shadow-inner">{summary}</p>
      ) : null}
    </div>
  );
}
