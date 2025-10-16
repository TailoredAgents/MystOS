import "dotenv/config";
import Module from "node:module";
import path from "node:path";

function registerAliases() {
  const originalResolve = (Module as unknown as { _resolveFilename: Module['_resolveFilename'] })._resolveFilename;
  (Module as unknown as { _resolveFilename: Module['_resolveFilename'] })._resolveFilename = function (
    request: string,
    parent: any,
    isMain: boolean,
    options: any
  ) {
    if (request.startsWith("@/")) {
      const absolute = path.resolve("apps/api/src", request.slice(2));
      return originalResolve.call(this, absolute, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
}

async function main() {
  registerAliases();
  const { getDb, payments } = await import("../apps/api/src/db");
  const stripeLib = await import("../apps/api/src/lib/stripe");
  const matching = await import("../apps/api/src/lib/payment-matching");

  const days = Number(process.env["STRIPE_BACKFILL_DAYS"] ?? 14);
  const charges = await stripeLib.listRecentCharges(days);
  const db = getDb();

  let upserted = 0;
  for (const c of charges) {
    const row = stripeLib.mapChargeToPaymentRow(c);
    const resolvedAppointmentId = row.appointmentId ?? (await matching.resolveAppointmentIdForCharge(db, c));

    await db
      .insert(payments)
      .values({
        stripeChargeId: row.stripeChargeId,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        method: row.method ?? null,
        cardBrand: row.cardBrand ?? null,
        last4: row.last4 ?? null,
        receiptUrl: row.receiptUrl ?? null,
        metadata: row.metadata ?? null,
        appointmentId: resolvedAppointmentId ?? null,
        createdAt: row.createdAt,
        capturedAt: row.capturedAt ?? null
      })
      .onConflictDoUpdate({
        target: payments.stripeChargeId,
        set: {
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          method: row.method ?? null,
          cardBrand: row.cardBrand ?? null,
          last4: row.last4 ?? null,
          receiptUrl: row.receiptUrl ?? null,
          metadata: row.metadata ?? null,
          appointmentId: resolvedAppointmentId ?? null,
          capturedAt: row.capturedAt ?? null,
          updatedAt: new Date()
        }
      });
    upserted += 1;
  }

  console.log(JSON.stringify({ ok: true, upserted, days }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
