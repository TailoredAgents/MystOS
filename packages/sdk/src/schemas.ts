import { z } from "zod";

export const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional()
});

export const propertySchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  propertyType: z.enum(["residential", "commercial"]).default("residential")
});

export const leadSourceSchema = z.object({
  service: z.string().min(1),
  notes: z.string().optional(),
  utm: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      term: z.string().optional(),
      content: z.string().optional()
    })
    .partial()
    .optional()
});

export const leadIntakeRequestSchema = z.object({
  contact: contactSchema,
  property: propertySchema,
  lead: leadSourceSchema
});

export const leadIntakeResponseSchema = z.object({
  leadId: z.string(),
  status: z.literal("received")
});

export const quoteRequestSchema = z.object({
  contactId: z.string().optional(),
  propertyId: z.string().optional(),
  service: z.string().min(1),
  description: z.string().optional(),
  surfaceArea: z.number().positive().optional(),
  utm: leadSourceSchema.shape.utm.optional()
});

export const quoteResponseSchema = z.object({
  quoteId: z.string(),
  status: z.enum(["pending-review", "priced", "needs-info"]),
  estimatedTotal: z.number().optional()
});

export const payDepositRequestSchema = z.object({
  quoteId: z.string(),
  amount: z.number().positive(),
  customerEmail: z.string().email(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});

export const payDepositResponseSchema = z.object({
  paymentLink: z.string().url(),
  expiresAt: z.string()
});

export type LeadIntakeRequest = z.infer<typeof leadIntakeRequestSchema>;
export type LeadIntakeResponse = z.infer<typeof leadIntakeResponseSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export type PayDepositRequest = z.infer<typeof payDepositRequestSchema>;
export type PayDepositResponse = z.infer<typeof payDepositResponseSchema>;

