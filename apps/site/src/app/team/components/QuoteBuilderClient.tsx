/* eslint-disable react/jsx-no-bind */
"use client";

import React from "react";
import { SubmitButton } from "@/components/SubmitButton";
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
};

export type QuoteBuilderZoneOption = {
  id: string;
  name: string;
};

interface QuoteBuilderClientProps {
  contacts: QuoteBuilderContactOption[];
  services: QuoteBuilderServiceOption[];
  zones: QuoteBuilderZoneOption[];
  defaultZoneId: string | null;
  defaultDepositRate: number;
}

export function QuoteBuilderClient({
  contacts,
  services,
  zones,
  defaultZoneId,
  defaultDepositRate
}: QuoteBuilderClientProps) {
  const [contactId, setContactId] = React.useState<string>(contacts[0]?.id ?? "");
  const [propertyId, setPropertyId] = React.useState<string>(contacts[0]?.properties[0]?.id ?? "");
  const [zoneId, setZoneId] = React.useState<string>(defaultZoneId ?? zones[0]?.id ?? "");
  const [selectedServices, setSelectedServices] = React.useState<string[]>([]);
  const [sendQuote, setSendQuote] = React.useState<boolean>(Boolean(contacts[0]?.email));

  const selectedContact = React.useMemo(
    () => contacts.find((contact) => contact.id === contactId) ?? null,
    [contactId, contacts]
  );

  const canSendEmail = Boolean(selectedContact?.email);

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

  const toggleService = React.useCallback((serviceId: string) => {
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      }
      return [...prev, serviceId];
    });
  }, []);

  const canSubmit =
    selectedContact !== null && propertyId.length > 0 && selectedServices.length > 0 && zoneId.length > 0;

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

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span>Service area</span>
              <select
                name="zoneId"
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span>Surface area (sq ft)</span>
              <input
                type="number"
                name="surfaceArea"
                min="0"
                step="1"
                placeholder={propertyOptions.length > 0 ? "Estimate the treated area" : "Optional"}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700">Services included</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((service) => {
                const checked = selectedServices.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                      checked
                        ? "border-primary-300 bg-primary-50 text-primary-800 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-primary-50/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={service.id}
                      checked={checked}
                      onChange={() => toggleService(service.id)}
                      className="mt-1 rounded border-slate-300 text-primary-600 focus:ring-primary-400"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{service.label}</span>
                      {service.description ? (
                        <span className="mt-1 block text-xs text-slate-500">{service.description}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Select at least one service to calculate pricing and generate the quote PDF.
            </p>
          </fieldset>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span>Deposit rate (0-1)</span>
              <input
                type="number"
                name="depositRate"
                min="0"
                max="1"
                step="0.05"
                placeholder={defaultDepositRate.toString()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span>Expires in (days)</span>
              <input
                type="number"
                name="expiresInDays"
                min="1"
                max="90"
                placeholder="30"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </label>
          </div>

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
