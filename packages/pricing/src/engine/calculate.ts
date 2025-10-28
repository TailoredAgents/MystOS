import { z } from "zod";
import {
  addOns,
  bundles,
  defaultDepositRate,
  defaultPricingContext,
  serviceRates,
  zones
} from "../config/defaults";
import type {
  QuoteBreakdown,
  QuoteRequestInput,
  ServiceBaseRate,
  ZoneConfig
} from "../types";

const quoteInputSchema = z.object({
  zoneId: z.string(),
  surfaceArea: z.number().positive().optional(),
  selectedServices: z.array(z.string()).min(1),
  selectedAddOns: z.array(z.string()).optional(),
  applyBundles: z.boolean().optional(),
  depositRate: z.number().positive().max(1).optional(),
  serviceOverrides: z.record(z.string(), z.number().positive()).optional()
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

function computeBundleDiscount(serviceIds: string[], applyBundles: boolean | undefined): number {
  if (!applyBundles) {
    return 0;
  }

  const eligibleBundles = bundles.filter((bundle) =>
    bundle.services.every((service) => serviceIds.includes(service))
  );

  if (!eligibleBundles.length) {
    return 0;
  }

  const discount = eligibleBundles.reduce((acc, bundle) => {
    const bundleTotal = bundle.services.reduce((total, serviceId) => {
      const rate = resolveServiceRate(serviceId);
      if (!rate) {
        return total;
      }
      return total + computeServiceAmount(rate);
    }, 0);

    return acc + (bundleTotal * bundle.discountPercentage) / 100;
  }, 0);

  return discount;
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
    applyBundles,
    depositRate,
    serviceOverrides
  } = parsed.data;
  const zone = resolveZone(zoneId);
  const overrides = (serviceOverrides ?? {}) as Record<string, number>;

  const lineItems: QuoteBreakdown["lineItems"] = [];

  const servicesSubtotal = selectedServices.reduce((sum, serviceId) => {
    const rate = resolveServiceRate(serviceId);

    if (!rate) {
      return sum;
    }

    const overrideAmount = overrides[serviceId];
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
  const allowBundleDiscounts = applyBundles && Object.keys(overrides).length === 0;
  const discounts = computeBundleDiscount(selectedServices, allowBundleDiscounts);
  const total = subtotal - discounts;

  if (discounts > 0) {
    lineItems.push({
      id: "bundle-discount",
      label: "Bundle Savings",
      amount: -discounts,
      category: "discount"
    });
  }

  const resolvedDepositRate =
    options?.depositRate ?? depositRate ?? input.depositRate ?? defaultDepositRate;
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

