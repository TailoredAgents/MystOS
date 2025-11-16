const STAGE_REASON_LABELS: Record<string, string> = {
  "quote.sent": "Quote sent",
  "quote.accepted": "Quote accepted",
  "quote.declined": "Quote declined",
  "quote.scheduled": "Job scheduled",
  "quote.rescheduled": "Job rescheduled",
  "payment.recorded": "Payment recorded"
};

export function formatStageUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(time));
}

function capitalizeWord(value: string): string {
  if (!value) return "";
  return value[0]?.toUpperCase() + value.slice(1);
}

export function formatStageReason(reason: string | null | undefined): string | null {
  if (typeof reason !== "string") {
    return null;
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  if (STAGE_REASON_LABELS[normalized]) {
    return STAGE_REASON_LABELS[normalized];
  }

  if (normalized.includes(".") || normalized.includes("_")) {
    const parts = normalized.replace(/[\._]+/g, " ").split(" ").filter(Boolean);
    if (parts.length > 0) {
      return parts.map(capitalizeWord).join(" ");
    }
  }

  return trimmed;
}
