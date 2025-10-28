import React, { type ReactElement } from "react";
import { PaymentsList } from "../PaymentsList";
import { callAdminApi } from "../lib/api";
import { attachPaymentAction, detachPaymentAction } from "../actions";

type PaymentDto = {
  id: string;
  stripeChargeId: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  cardBrand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  createdAt: string;
  appointment: null | { id: string; status: string; startAt: string | null; contactName: string | null };
};

export async function PaymentsSection(): Promise<ReactElement> {
  const res = await callAdminApi("/api/payments?status=all");
  if (!res.ok) throw new Error("Failed to load payments");

  const payload = (await res.json()) as {
    payments: PaymentDto[];
    summary: { total: number; matched: number; unmatched: number };
  };

  return (
    <PaymentsList
      initial={payload.payments}
      summary={payload.summary}
      attachAction={attachPaymentAction}
      detachAction={detachPaymentAction}
    />
  );
}
