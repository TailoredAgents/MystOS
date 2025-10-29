/* eslint-disable react/jsx-no-bind */
"use client";

import React from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { ConcreteSurfaceKind } from "@myst-os/pricing/src/types";
import { createQuoteAction } from "../actions";

export type QuoteBuilderPropertyOption = {
  id: string;
  label: string;
};

export type QuoteBuilderContactOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  properties: QuoteBuilderPropertyOption[];
};

export type QuoteBuilderServiceOption = {
  id: string;
  label: string;
  description?: string | null;
  allowCustomPrice: boolean;
  autoPricingNote?: string | null;
};

export type QuoteBuilderZoneOption = {
  id: string;
  name: string;
};

const MAX_CONCRETE_SURFACES = 3;
const CONCRETE_RATE = 0.14;
const concreteSurfaceOptions: Array<{ value: ConcreteSurfaceKind; label: string }> = [
  { value: "driveway", label: "Driveway" },
  { value: "deck", label: "Deck/Patio" },
  { value: "other", label: "Other" }
];

type ConcreteSurfaceFormEntry = {
  id: string;
  kind: ConcreteSurfaceKind;
  squareFeet: string;
};

interface QuoteBuilderClientProps {
  contacts: QuoteBuilderContactOption[];
  services: QuoteBuilderServiceOption[];
  zones: QuoteBuilderZoneOption[];
  defaultZoneId: string | null;
  initialContactId?: string;
}

export function QuoteBuilderClient({
  contacts,
  services,
  zones,
  defaultZoneId,
  initialContactId
}: QuoteBuilderClientProps) {
  const [contactId, setContactId] = React.useState<string>(() => {
    if (initialContactId) {
      const match = contacts.find((contact) => contact.id === initialContactId);
      if (match) {
        return match.id;
      }
    }
    return contacts[0]?.id ?? "";
  });
  const [propertyId, setPropertyId] = React.useState<string>(() => {
    if (initialContactId) {
      const match = contacts.find((contact) => contact.id === initialContactId);
      if (match) {
        return match.properties[0]?.id ?? "";
      }
    }
    return contacts[0]?.properties[0]?.id ?? "";
  });
  const zoneId = React.useMemo(() => defaultZoneId ?? zones[0]?.id ?? "", [defaultZoneId, zones]);
  const [selectedServices, setSelectedServices] = React.useState<string[]>([]);
  const [sendQuote, setSendQuote] = React.useState<boolean>(() => {
    if (initialContactId) {
      const match = contacts.find((contact) => contact.id === initialContactId);
      if (match) {
        return Boolean(match.email);
      }
    }
    return Boolean(contacts[0]?.email);
  });
  const [servicePrices, setServicePrices] = React.useState<Record<string, string>>({});
  const [concreteSurfaces, setConcreteSurfaces] = React.useState<ConcreteSurfaceFormEntry[]>([]);

  const createConcreteSurfaceEntry = React.useCallback((): ConcreteSurfaceFormEntry => {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "driveway",
      squareFeet: ""
    };
  }, []);

  const addConcreteSurface = React.useCallback(() => {
    setConcreteSurfaces((prev) => {
      if (prev.length >= MAX_CONCRETE_SURFACES) {
        return prev;
      }
      return [...prev, createConcreteSurfaceEntry()];
    });
  }, [createConcreteSurfaceEntry]);

  const updateConcreteSurface = React.useCallback(
    (id: string, updates: Partial<ConcreteSurfaceFormEntry>) => {
      setConcreteSurfaces((prev) =>
        prev.map((surface) => (surface.id === id ? { ...surface, ...updates } : surface))
      );
    },
    []
  );

  const removeConcreteSurface = React.useCallback((id: string) => {
    setConcreteSurfaces((prev) => prev.filter((surface) => surface.id !== id));
  }, []);

  const selectedContact = React.useMemo(
    () => contacts.find((contact) => contact.id === contactId) ?? null,
    [contactId, contacts]
  );

  const canSendEmail = Boolean(selectedContact?.email);
  const serviceLookup = React.useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const selectableServices = React.useMemo(
    () => services.filter((service) => service.id !== "driveway"),
    [services]
  );
  const normalizedConcreteSurfaces = React.useMemo(() => {
    return concreteSurfaces
      .map((surface) => {
        const trimmed = surface.squareFeet.trim();
        if (trimmed.length === 0) {
          return null;
        }
        const amount = Number(trimmed);
        if (!Number.isFinite(amount) || amount <= 0) {
          return null;
        }
        return {
          kind: surface.kind,
          squareFeet: amount
        };
      })
      .filter((entry): entry is { kind: ConcreteSurfaceKind; squareFeet: number } => entry !== null);
  }, [concreteSurfaces]);
  const concreteValid =
    concreteSurfaces.length === 0 || normalizedConcreteSurfaces.length === concreteSurfaces.length;
  const concreteTotal = React.useMemo(
    () => normalizedConcreteSurfaces.reduce((sum, surface) => sum + surface.squareFeet * CONCRETE_RATE, 0),
    [normalizedConcreteSurfaces]
  );
  const roundedConcreteTotal = Math.round(concreteTotal * 100) / 100;
  const canAddConcreteSurface = concreteSurfaces.length < MAX_CONCRETE_SURFACES;
  const serializedConcreteSurfaces = React.useMemo(
    () =>
      JSON.stringify(
        normalizedConcreteSurfaces.map(({ kind, squareFeet }) => ({
          kind,
          squareFeet
        }))
      ),
    [normalizedConcreteSurfaces]
  );

  React.useEffect(() => {
    setSelectedServices((prev) => {
      const hasDriveway = prev.includes("driveway");
      if (normalizedConcreteSurfaces.length > 0) {
        return hasDriveway ? prev : [...prev, "driveway"];
      }
      if (!hasDriveway) {
        return prev;
      }
      return prev.filter((id) => id !== "driveway");
    });
  }, [normalizedConcreteSurfaces.length]);

  React.useEffect(() => {
    if (normalizedConcreteSurfaces.length === 0) {
      setServicePrices((prev) => {
        if (!("driveway" in prev)) {
          return prev;
        }
        const { driveway, ...rest } = prev;
        return rest;
      });
    }
  }, [normalizedConcreteSurfaces.length]);

  const serviceOverrides = React.useMemo(() => {
    const overrides: Record<string, number> = {};
    for (const serviceId of selectedServices) {
      const service = serviceLookup.get(serviceId);
      if (!service || !service.allowCustomPrice) continue;
      const raw = servicePrices[serviceId];
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      const value = Number(trimmed);
      if (Number.isFinite(value) && value > 0) {
        overrides[serviceId] = value;
      }
    }
    if (normalizedConcreteSurfaces.length > 0) {
      overrides["driveway"] = roundedConcreteTotal;
    }
    return overrides;
  }, [
    normalizedConcreteSurfaces.length,
    roundedConcreteTotal,
    selectedServices,
    serviceLookup,
    servicePrices
  ]);

  const hasAllCustomPrices = React.useMemo(() => {
    return selectedServices.every((serviceId) => {
      const service = serviceLookup.get(serviceId);
      if (!service || !service.allowCustomPrice) {
        return true;
      }
      const raw = servicePrices[serviceId];
      if (typeof raw !== "string") {
        return false;
      }
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return false;
      }
      const value = Number(trimmed);
      return Number.isFinite(value) && value > 0;
    });
  }, [selectedServices, serviceLookup, servicePrices]);
  const serializedOverrides = React.useMemo(() => JSON.stringify(serviceOverrides), [serviceOverrides]);

  React.useEffect(() => {
    if (!initialContactId) return;
    const match = contacts.find((contact) => contact.id === initialContactId);
    if (!match) return;
    if (match.id === contactId) return;
    setContactId(match.id);
    setPropertyId(match.properties[0]?.id ?? "");
    setSendQuote(Boolean(match.email));
  }, [initialContactId, contacts, contactId]);

  React.useEffect(() => {
    if (!selectedContact) {
      setPropertyId("");
      return;
    }
    const current = selectedContact.properties.find((property) => property.id === propertyId);
    if (!current) {
      setPropertyId(selectedContact.properties[0]?.id ?? "");
    }
  }, [propertyId, selectedContact]);

  React.useEffect(() => {
    if (!canSendEmail) {
      setSendQuote(false);
    }
  }, [canSendEmail]);

  const toggleService = React.useCallback(
    (serviceId: string) => {
      setSelectedServices((prev) => {
        if (prev.includes(serviceId)) {
          setServicePrices((current) => {
            if (!(serviceId in current)) {
              return current;
            }
            const { [serviceId]: _removed, ...rest } = current;
            return rest;
          });
          return prev.filter((id) => id !== serviceId);
        }
        return [...prev, serviceId];
      });
    },
    [setServicePrices]
  );

  const handlePriceChange = React.useCallback(
    (serviceId: string, value: string) => {
      setServicePrices((prev) => ({
        ...prev,
        [serviceId]: value
      }));
    },
    [setServicePrices]
  );

  const canSubmit =
    selectedContact !== null &&
    propertyId.length > 0 &&
    selectedServices.length > 0 &&
    zoneId.length > 0 &&
    hasAllCustomPrices &&
    concreteValid;

  if (contacts.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-600 shadow-xl shadow-slate-200/60">
        <h2 className="text-xl font-semibold text-slate-900">No contacts yet</h2>
        <p className="mt-2">
          Add a contact with property details before creating an email-ready quote. Once a lead exists, you can build a
          proposal here and send it to their inbox in one step.
        </p>
      </section>
    );
  }

  const propertyOptions = selectedContact?.properties ?? [];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Build and send a quote</h2>
            <p className="text-sm text-slate-600">
              Choose a saved contact and property, bundle the services, and optionally email the proposal right away.
            </p>
          </div>
        </div>

        <form action={createQuoteAction} className="mt-5 space-y-6">
          <input type="hidden" name="services" value={JSON.stringify(selectedServices)} />
          <input type="hidden" name="serviceOverrides" value={serializedOverrides} />
          <input type="hidden" name="concreteSurfaces" value={serializedConcreteSurfaces} />
          <input type="hidden" name="zoneId" value={zoneId} />

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span>Contact</span>
              <select
                name="contactId"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
              {selectedContact?.email ? (
                <span className="text-xs text-slate-500">Email on file: {selectedContact.email}</span>
              ) : (
                <span className="text-xs text-slate-400">
                  This contact does not have an email yet. Add one to send quotes.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span>Property</span>
              <select
                name="propertyId"
                value={propertyId}
                onChange={(event) => setPropertyId(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                disabled={propertyOptions.length === 0}
              >
                {propertyOptions.length === 0 ? (
                  <option value="">
                    {selectedContact ? "No property on file" : "Select a contact first"}
                  </option>
                ) : (
                  propertyOptions.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.label}
                    </option>
                  ))
                )}
              </select>
              {propertyOptions.length === 0 ? (
                <span className="text-xs text-slate-400">
                  Save a property for this contact in the Contacts tab to enable quoting.
                </span>
              ) : null}
            </label>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/85 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-700">Concrete surfaces</span>
                <p className="text-xs text-slate-500">
                  Automatically priced at ${CONCRETE_RATE.toFixed(2)} per sq ft. Add up to three areas.
                </p>
              </div>
              <button
                type="button"
                onClick={addConcreteSurface}
                disabled={!canAddConcreteSurface}
                className="inline-flex items-center justify-center rounded-full border border-primary-200 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add surface
              </button>
            </div>
            {concreteSurfaces.length === 0 ? (
              <p className="text-xs text-slate-500">No concrete surfaces added.</p>
            ) : (
              <div className="space-y-3">
                {concreteSurfaces.map((surface, index) => (
                  <div
                    key={surface.id}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  >
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      <span>Surface type {index + 1}</span>
                      <select
                        value={surface.kind}
                        onChange={(event) =>
                          updateConcreteSurface(surface.id, {
                            kind: event.target.value as ConcreteSurfaceKind
                          })
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
                      >
                        {concreteSurfaceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      <span>Square feet</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={surface.squareFeet}
                        onChange={(event) =>
                          updateConcreteSurface(surface.id, { squareFeet: event.target.value })
                        }
                        placeholder="e.g. 1200"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeConcreteSurface(surface.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {normalizedConcreteSurfaces.length > 0 ? (
              <p className="text-xs font-medium text-slate-600">
                Concrete total: ${roundedConcreteTotal.toFixed(2)}
              </p>
            ) : null}
            {concreteSurfaces.length > 0 && !concreteValid ? (
              <p className="text-xs text-rose-500">
                Enter a surface type and square footage for each concrete area.
              </p>
            ) : null}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">Services included</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectableServices.map((service) => {
                const checked = selectedServices.includes(service.id);
                const containerClasses = checked
                  ? "border-primary-300 bg-primary-50 text-primary-800 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-primary-50/40";
                const priceValue = servicePrices[service.id] ?? "";
                const requiresCustomPrice = service.allowCustomPrice;
                const trimmedPrice = priceValue.trim();
                const numericPrice = Number(trimmedPrice);
                const priceInvalid =
                  requiresCustomPrice &&
                  checked &&
                  (trimmedPrice.length === 0 || !Number.isFinite(numericPrice) || numericPrice <= 0);
                return (
                  <div
                    key={service.id}
                    className={`rounded-2xl border px-4 py-3 transition ${containerClasses}`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        value={service.id}
                        checked={checked}
                        onChange={() => toggleService(service.id)}
                        className="mt-1 rounded border-slate-300 text-primary-600 focus:ring-primary-400"
                      />
                      <div className="flex-1">
                        <span className="block text-sm font-semibold">{service.label}</span>
                        {service.description ? (
                          <span className="mt-1 block text-xs text-slate-500">{service.description}</span>
                        ) : null}
                      </div>
                    </label>
                    {requiresCustomPrice ? (
                      <div className="mt-3 space-y-1 pl-8">
                        <label className="flex flex-col gap-1 text-xs text-slate-600">
                          <span className="font-medium text-slate-700">Custom price (total)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={priceValue}
                            onChange={(event) => handlePriceChange(service.id, event.target.value)}
                            disabled={!checked}
                            placeholder="Enter total price"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </label>
                        {checked ? (
                          <p className="text-[11px] text-slate-500">Provide the total for this service.</p>
                        ) : (
                          <p className="text-[11px] text-slate-400">Select this service to enter a price.</p>
                        )}
                        {priceInvalid ? (
                          <p className="text-[11px] text-rose-500">Enter a positive amount.</p>
                        ) : null}
                      </div>
                    ) : service.autoPricingNote ? (
                      <p className="mt-3 pl-8 text-[11px] text-slate-500">{service.autoPricingNote}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Select at least one service to calculate pricing and generate the quote PDF.
            </p>
          </fieldset>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="applyBundles"
                defaultChecked
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-400"
              />
              Apply bundle discounts automatically
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="sendQuote"
                checked={sendQuote}
                onChange={(event) => setSendQuote(event.target.checked)}
                disabled={!canSendEmail}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                title={!canSendEmail ? "Add an email to this contact to enable sending" : undefined}
              />
              Email the quote to this contact immediately
            </label>
            <p className="text-xs text-slate-500">
              We'll still show the share link so you can copy it into SMS or chat, even when the email goes out.
            </p>
            {!canSendEmail ? (
              <p className="text-xs font-medium text-amber-600">
                Add an email address to this contact to enable sending the quote automatically.
              </p>
            ) : null}
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span>Internal notes</span>
            <textarea
              name="notes"
              rows={4}
              placeholder="Optional details for the homeowner or crew"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {selectedContact ? (
                <>
                  Sending to <span className="font-medium text-slate-700">{selectedContact.name}</span>
                  {selectedContact.email ? ` (${selectedContact.email})` : ""}.
                </>
              ) : (
                "Choose a contact to enable quoting."
              )}
            </div>
            <SubmitButton
              className="inline-flex items-center rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200/50 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              pendingLabel="Creating quote..."
              disabled={!canSubmit}
            >
              Create quote
            </SubmitButton>
            {hasAllCustomPrices ? null : (
              <p className="w-full text-[11px] text-rose-500">Enter a custom price for each selected service.</p>
            )}
            {concreteValid ? null : (
              <p className="w-full text-[11px] text-rose-500">
                Enter a surface type and square footage for each concrete area.
              </p>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-xs text-slate-500 shadow-md shadow-slate-200/60">
        <h3 className="text-sm font-semibold text-slate-700">Workflow tips</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Need a new contact? Add them in the Contacts tab first so their property details are available here.</li>
          <li>You can uncheck the email option to copy the share link and send it manually via SMS or chat.</li>
          <li>Bundle discounts apply automatically when qualifying services are selected together.</li>
        </ul>
      </div>
    </section>
  );
}

export default QuoteBuilderClient;
