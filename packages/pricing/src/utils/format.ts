/**
 * Formats a number as USD currency. Consumers can override for other locales.
 */
export function formatCurrency(value: number, locale = "en-US", currency = "USD"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

