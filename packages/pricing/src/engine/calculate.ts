import { z } from "zod";
import { addOns, defaultPricingContext, serviceRates, zones } from "../config/defaults";
import type {
  QuoteBreakdown,
  QuoteRequestInput,
  ServiceBaseRate,
  ZoneConfig,
  ConcreteSurfaceKind
} from "../types";

const CONCRETE_RATE = 0.14;

const quoteInputSchema = z.object({
  zoneId: z.string(),
  surfaceArea: z.number().positive().optional(),
  selectedServices: z.array(z.string()).min(1),
  selectedAddOns: z.array(z.string()).optional(),
  discountType: z.enum(["percent", "amount"]).optional(),
  discountValue: z.number().nonnegative().optional(),
  depositRate: z.number().positive().max(1).optional(),
  serviceOverrides: z.record(z.string(), z.number().positive()).optional(),
  concreteSurfaces: z
    .array(
      z.object({
        kind: z.enum(["driveway", "deck", "other"]),
        squareFeet: z.number().positive()
      })
    )
    .max(3)
    .optional(),
  manualConcreteSurfaces: z
    .array(
      z.object({
        kind: z.enum(["driveway", "deck", "other"]),
        amount: z.number().positive()
      })
    )
    .max(3)
    .optional()
});

function resolveZone(zoneId: string): ZoneConfig {
  const found = zones.find((zone) => zone.id === zoneId);
  return found ?? defaultPricingContext.zone;
}

function resolveServiceRate(serviceId: string): ServiceBaseRate | undefined {
  return serviceRates.find((rate) => rate.service === serviceId);
}

function computeServiceAmount(rate: ServiceBaseRate, surfaceArea?: number): number {
  if (typeof rate.flatRate === "number") {
    return rate.flatRate;
  }

  const area = surfaceArea ?? rate.minimumSquareFootage ?? 0;
  const variable = rate.pricePerSquareFoot ? area * rate.pricePerSquareFoot : 0;
  const base = rate.basePrice ?? 0;

  return Math.max(base, base + variable);
}

// Manual discount is applied to subtotal (services + add-ons + travel)
function computeManualDiscount(
  subtotal: number,
  type: "percent" | "amount" | undefined,
  value: number | undefined
): number {
  if (!type || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (type === "percent") {
    const pct = Math.max(0, Math.min(100, value));
    return Math.min(subtotal, Math.round(subtotal * (pct / 100) * 100) / 100);
  }
  // amount
  const amount = Math.round(Math.max(0, value) * 100) / 100;
  return Math.min(subtotal, amount);
}

export function calculateQuoteBreakdown(
  input: QuoteRequestInput,
  options?: { depositRate?: number }
): QuoteBreakdown {
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) {
    throw parsed.error;
  }

  const {
    zoneId,
    surfaceArea,
    selectedServices,
    selectedAddOns,
    discountType,
    discountValue,
    depositRate,
    serviceOverrides,
    concreteSurfaces,
    manualConcreteSurfaces
  } = parsed.data;
  const zone = resolveZone(zoneId);
  const overrides = (serviceOverrides ?? {}) as Record<string, number>;
  const normalizedConcreteSurfaces = (concreteSurfaces ?? []).map((surface) => ({
    kind: surface.kind as ConcreteSurfaceKind,
    squareFeet: surface.squareFeet
  }));
  const normalizedManualConcreteSurfaces = (manualConcreteSurfaces ?? []).map((surface) => ({
    kind: surface.kind as ConcreteSurfaceKind,
    amount: surface.amount
  }));

  const concreteLineItems: QuoteBreakdown["lineItems"] = [];
  let concreteTotal = 0;

  if (normalizedConcreteSurfaces.length > 0) {
    normalizedConcreteSurfaces.forEach((surface, index) => {
      const labelBase =
        surface.kind === "driveway"
          ? "Driveway"
          : surface.kind === "deck"
            ? "Deck/Patio"
            : "Concrete Surface";
      const amount = Math.round(surface.squareFeet * CONCRETE_RATE * 100) / 100;
      concreteTotal += amount;
      concreteLineItems.push({
        id: `concrete-${index}`,
        label: `${labelBase} ${index + 1} (${surface.squareFeet} sq ft)`,
        amount,
        category: "service"
      });
    });

    overrides["driveway"] = Math.round(concreteTotal * 100) / 100;
  }

  const manualConcreteLineItems: QuoteBreakdown["lineItems"] = [];
  let manualConcreteTotal = 0;

  if (normalizedManualConcreteSurfaces.length > 0) {
    normalizedManualConcreteSurfaces.forEach((surface, index) => {
      const labelBase =
        surface.kind === "driveway"
          ? "Driveway"
          : surface.kind === "deck"
            ? "Deck/Patio"
            : "Concrete Surface";
      manualConcreteTotal += surface.amount;
      manualConcreteLineItems.push({
        id: `manual-concrete-${index}`,
        label: `${labelBase} (manual ${index + 1})`,
        amount: surface.amount,
        category: "service"
      });
    });

    if (normalizedConcreteSurfaces.length === 0) {
      overrides["driveway"] = Math.round(manualConcreteTotal * 100) / 100;
    }
  }

  const lineItems: QuoteBreakdown["lineItems"] = [];

  const servicesSubtotal = selectedServices.reduce((sum, serviceId) => {
    const rate = resolveServiceRate(serviceId);

    if (!rate) {
      return sum;
    }

    const overrideAmount = overrides[serviceId];

    if (serviceId === "driveway") {
      if (concreteLineItems.length > 0) {
        lineItems.push(...concreteLineItems);
        return sum + concreteTotal;
      }
      if (manualConcreteLineItems.length > 0) {
        lineItems.push(...manualConcreteLineItems);
        return sum + manualConcreteTotal;
      }
      if (typeof overrideAmount === "number") {
        lineItems.push({
          id: `service-${serviceId}`,
          label: rate.label,
          amount: overrideAmount,
          category: "service"
        });
        return sum + overrideAmount;
      }
    }

    const amount =
      typeof overrideAmount === "number" && serviceId !== "driveway"
        ? overrideAmount
        : computeServiceAmount(rate, surfaceArea);
    lineItems.push({
      id: `service-${serviceId}`,
      label: rate.label,
      amount,
      category: "service"
    });

    return sum + amount;
  }, 0);

  const addOnsTotal = (selectedAddOns ?? []).reduce((total, addOnId) => {
    const config = addOns.find((item) => item.id === addOnId);
    if (!config) {
      return total;
    }

    lineItems.push({
      id: `addon-${config.id}`,
      label: config.name,
      amount: config.price,
      category: "add-on"
    });

    return total + config.price;
  }, 0);

  const travelFee = selectedServices.some((serviceId) => {
    const rate = resolveServiceRate(serviceId);
    return rate?.includesTravel;
  })
    ? 0
    : zone.travelFee;

  if (travelFee > 0) {
    lineItems.push({
      id: "travel-fee",
      label: `${zone.name} travel`,
      amount: travelFee,
      category: "travel"
    });
  }

  const subtotal = servicesSubtotal + addOnsTotal + travelFee;
  const discounts = computeManualDiscount(subtotal, discountType, discountValue);
  const total = subtotal - discounts;

  if (discounts > 0) {
    lineItems.push({
      id: "manual-discount",
      label: "Manual Discount",
      amount: -discounts,
      category: "discount"
    });
  }

  const resolvedDepositRate =
    options?.depositRate ?? depositRate ?? input.depositRate ?? 0;
  const depositDue = Math.round(total * resolvedDepositRate * 100) / 100;
  const balanceDue = Math.max(total - depositDue, 0);

  return {
    subtotal: servicesSubtotal,
    travelFee,
    discounts,
    addOnsTotal,
    total,
    depositDue,
    balanceDue,
    depositRate: resolvedDepositRate,
    lineItems
  };
}

