'use client';

import { useEffect, useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import {
  addPropertyAction,
  createTaskAction,
  deleteContactAction,
  deletePropertyAction,
  deleteTaskAction,
  updateContactAction,
  updatePropertyAction,
  updateTaskAction
} from "../actions";
import type { ContactSummary, PropertySummary, TaskSummary } from "./contacts.types";
import { formatStageReason, formatStageUpdatedAt } from "./pipelineStageMeta";

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Scheduled Quote",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost"
};

const STALLED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function stageLabel(stage: string): string {
  return PIPELINE_STAGE_LABELS[stage] ?? stage;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "N/A";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatDate(iso: string | null): string {
  if (!iso) return "No due date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(date);
}

function mapsUrl(property: PropertySummary | undefined): string | null {
  if (!property) return null;
  const parts = [
    property.addressLine1,
    property.addressLine2 ?? "",
    `${property.city}, ${property.state} ${property.postalCode}`
  ]
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

function formatCoordinateValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(5);
}

function teamLink(tab: string, params?: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  query.set("tab", tab);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.trim().length > 0) {
        query.set(key, value.trim());
      }
    }
  }
  return `/team?${query.toString()}`;
}

function isStalledQuote(stage: string, updatedAt: string | null): boolean {
  if (stage !== "quoted" || !updatedAt) {
    return false;
  }
  const time = Date.parse(updatedAt);
  if (Number.isNaN(time)) {
    return false;
  }
  return Date.now() - time > STALLED_WINDOW_MS;
}

type ContactCardProps = {
  contact: ContactSummary;
};

const taskStatusLabel: Record<string, string> = {
  open: "Open",
  completed: "Completed"
};

function ContactCard({ contact }: ContactCardProps) {
  const [contactState, setContactState] = useState<ContactSummary>(contact);
  const [editingContact, setEditingContact] = useState(false);
  const [addingProperty, setAddingProperty] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);

  useEffect(() => {
    setContactState(contact);
  }, [contact]);

  const primaryProperty = contactState.properties[0];
  const mapsLink = mapsUrl(primaryProperty);

  const openTasks = useMemo(
    () => contactState.tasks.filter((task) => task.status !== "completed"),
    [contactState.tasks]
  );

  const completedTasks = useMemo(
    () => contactState.tasks.filter((task) => task.status === "completed"),
    [contactState.tasks]
  );

  const stageReason = formatStageReason(contactState.pipeline.notes);
  const stageUpdatedOn = formatStageUpdatedAt(contactState.pipeline.updatedAt);
  const stalledQuote = isStalledQuote(contactState.pipeline.stage, contactState.pipeline.updatedAt);

  return (
    <li className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <h3 className="text-lg font-semibold text-slate-900">{contactState.name}</h3>
              <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                {stageLabel(contactState.pipeline.stage)}
              </span>
            </div>
            {stageUpdatedOn || stageReason || stalledQuote ? (
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                {stageUpdatedOn || stageReason ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
                    Stage updated {stageUpdatedOn ?? "recently"}
                    {stageReason ? ` - ${stageReason}` : ""}
                  </span>
                ) : null}
                {stalledQuote ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 font-semibold uppercase tracking-wide text-amber-700">
                    Stalled quote - Needs follow-up
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {contactState.email ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">{contactState.email}</span>
              ) : null}
              {contactState.phone ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">{contactState.phone}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
                Appointments: {contactState.stats.appointments}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
                Quotes: {contactState.stats.quotes}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Open tasks: {openTasks.length}</span>
            </div>
            <p className="text-xs text-slate-400">Last activity: {formatDateTime(contactState.lastActivityAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-700"
              onClick={() => setEditingContact((prev) => !prev)}
            >
              {editingContact ? "Close edit" : "Edit contact"}
            </button>
            <form action={deleteContactAction} className="inline">
              <input type="hidden" name="contactId" value={contactState.id} />
              <SubmitButton className="rounded-full border border-rose-200 px-4 py-2 font-medium text-rose-600 transition hover:bg-rose-50" pendingLabel="Removing...">
                Delete
              </SubmitButton>
            </form>
            <a
              className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-700"
              href={teamLink("quote-builder", { contactId: contactState.id })}
            >
              Create quote
            </a>
            <a
              className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-600 transition hover:border-primary-300 hover:text-primary-700"
              href={teamLink("myday", { contactId: contactState.id })}
            >
              Schedule visit
            </a>
            <a
              className={`rounded-full border px-4 py-2 font-medium ${
                mapsLink ? "border-slate-200 text-slate-600 hover:border-primary-300 hover:text-primary-700" : "pointer-events-none border-slate-100 text-slate-300"
              }`}
              href={mapsLink ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              Open in Maps
            </a>
          </div>
        </div>

        {editingContact ? (
          <form
            action={updateContactAction}
            className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 shadow-inner"
            onSubmit={() => setEditingContact(false)}
          >
            <input type="hidden" name="contactId" value={contactState.id} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span>First name</span>
                <input
                  name="firstName"
                  defaultValue={contactState.firstName}
                  required
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>Last name</span>
                <input
                  name="lastName"
                  defaultValue={contactState.lastName}
                  required
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>Email</span>
                <input name="email" defaultValue={contactState.email ?? ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Phone</span>
                <input name="phone" defaultValue={contactState.phone ?? ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
            </div>
            <div className="flex gap-2">
              <SubmitButton className="rounded-full bg-primary-600 px-4 py-2 font-semibold text-white shadow hover:bg-primary-700" pendingLabel="Saving...">
                Save changes
              </SubmitButton>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
                onClick={() => setEditingContact(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Properties</h4>
                {addingProperty ? null : (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700"
                    onClick={() => {
                      setAddingProperty(true);
                      setEditingPropertyId(null);
                    }}
                  >
                    Add property
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-3">
                {contactState.properties.map((property) => (
                  <div key={property.id} className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm shadow-slate-200/40">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 text-sm text-slate-600">
                        <p className="font-medium text-slate-800">
                          {property.addressLine1}
                          {property.addressLine2 ? `, ${property.addressLine2}` : ""}
                        </p>
                        <p>
                          {property.city}, {property.state} {property.postalCode}
                        </p>
                        <p className="text-xs text-slate-400">Added {formatDateTime(property.createdAt)}</p>
                        <p
                          className={`text-[11px] font-semibold ${
                            property.lat !== null && property.lat !== undefined && property.lng !== null && property.lng !== undefined
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }`}
                        >
                          {property.lat !== null && property.lat !== undefined && property.lng !== null && property.lng !== undefined
                            ? `Map pin saved · ${formatCoordinateValue(property.lat)}, ${formatCoordinateValue(property.lng)}`
                            : "Map pin needed for route-aware scheduling"}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700"
                          onClick={() => {
                            setEditingPropertyId((current) => (current === property.id ? null : property.id));
                            setAddingProperty(false);
                          }}
                        >
                          {editingPropertyId === property.id ? "Close" : "Edit"}
                        </button>
                        <form action={deletePropertyAction}>
                          <input type="hidden" name="contactId" value={contactState.id} />
                          <input type="hidden" name="propertyId" value={property.id} />
                          <SubmitButton className="rounded-full border border-rose-200 px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50" pendingLabel="Removing...">
                            Delete
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                    {editingPropertyId === property.id ? (
                      <form
                        action={updatePropertyAction}
                        className="mt-3 grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-2"
                        onSubmit={() => setEditingPropertyId(null)}
                      >
                        <input type="hidden" name="contactId" value={contactState.id} />
                        <input type="hidden" name="propertyId" value={property.id} />
                        <label className="flex flex-col gap-1">
                          <span>Address line 1</span>
                          <input name="addressLine1" defaultValue={property.addressLine1} required className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span>Address line 2</span>
                          <input name="addressLine2" defaultValue={property.addressLine2 ?? ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span>City</span>
                          <input name="city" defaultValue={property.city} required className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1">
                            <span>State</span>
                            <input name="state" defaultValue={property.state} required maxLength={2} className="rounded-xl border border-slate-200 bg-white px-3 py-2 uppercase" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span>Postal code</span>
                            <input name="postalCode" defaultValue={property.postalCode} required className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1">
                            <span>Latitude (optional)</span>
                            <input
                              name="lat"
                              type="number"
                              step="0.000001"
                              min="-90"
                              max="90"
                              defaultValue={property.lat ?? ""}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span>Longitude (optional)</span>
                            <input
                              name="lng"
                              type="number"
                              step="0.000001"
                              min="-180"
                              max="180"
                              defaultValue={property.lng ?? ""}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                            />
                          </label>
                        </div>
                        <p className="sm:col-span-2 text-[10px] text-slate-400">
                          Paste decimal degrees from Google Maps to unlock accurate routing suggestions.
                        </p>
                        <div className="flex gap-2 sm:col-span-2">
                          <SubmitButton className="rounded-full bg-primary-600 px-4 py-2 font-semibold text-white shadow hover:bg-primary-700" pendingLabel="Saving...">
                            Save property
                          </SubmitButton>
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
                            onClick={() => setEditingPropertyId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
              {addingProperty ? (
                <form
                  action={addPropertyAction}
                  className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-xs text-slate-600 shadow-inner sm:grid-cols-2"
                  onSubmit={() => setAddingProperty(false)}
                >
                  <input type="hidden" name="contactId" value={contactState.id} />
                  <label className="flex flex-col gap-1">
                    <span>Address line 1</span>
                    <input name="addressLine1" required className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Address line 2</span>
                    <input name="addressLine2" className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>City</span>
                    <input name="city" required className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span>State</span>
                      <input name="state" required maxLength={2} className="rounded-xl border border-slate-200 bg-white px-3 py-2 uppercase" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Postal code</span>
                      <input name="postalCode" required className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span>Latitude (optional)</span>
                      <input name="lat" type="number" step="0.000001" min="-90" max="90" className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Longitude (optional)</span>
                      <input name="lng" type="number" step="0.000001" min="-180" max="180" className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                    </label>
                  </div>
                  <p className="sm:col-span-2 text-[10px] text-slate-400">
                    Optional: paste decimal coordinates to help Myst plot efficient routes.
                  </p>
                  <div className="flex gap-2 sm:col-span-2">
                    <SubmitButton className="rounded-full bg-primary-600 px-4 py-2 font-semibold text-white shadow hover:bg-primary-700" pendingLabel="Saving...">
                      Save property
                    </SubmitButton>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
                      onClick={() => setAddingProperty(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Tasks</h4>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-primary-300 hover:text-primary-700"
                  onClick={() => setShowTaskForm((prev) => !prev)}
                >
                  {showTaskForm ? "Close" : "Add task"}
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {contactState.tasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-2 text-xs text-slate-500">
                    No tasks yet. Capture follow-ups to keep the pipeline moving.
                  </p>
                ) : (
                  <>
                    {openTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                    {completedTasks.length > 0 ? (
                      <details className="rounded-xl border border-slate-200 bg-white/70 p-3 text-slate-500">
                        <summary className="cursor-pointer text-xs font-medium text-slate-600">
                          Completed ({completedTasks.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {completedTasks.map((task) => (
                            <TaskRow key={task.id} task={task} />
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </>
                )}
              </div>
              {showTaskForm ? (
                <form
                  action={createTaskAction}
                  className="mt-4 grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-2"
                  onSubmit={() => setShowTaskForm(false)}
                >
                  <input type="hidden" name="contactId" value={contactState.id} />
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span>Title</span>
                    <input name="title" required className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Due date</span>
                    <input name="dueAt" type="date" className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Assignee</span>
                    <input name="assignedTo" placeholder="Optional" className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <SubmitButton className="rounded-full bg-primary-600 px-4 py-2 font-semibold text-white shadow hover:bg-primary-700" pendingLabel="Saving...">
                      Add task
                    </SubmitButton>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
                      onClick={() => setShowTaskForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  const isCompleted = task.status === "completed";
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-xs shadow-sm ${
        isCompleted ? "border-slate-200 bg-white/70 text-slate-500" : "border-emerald-200/70 bg-emerald-50/70 text-emerald-900"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className={`text-sm font-semibold ${isCompleted ? "text-slate-600" : "text-emerald-900"}`}>{task.title}</p>
          <p className="text-[11px]">
            {taskStatusLabel[task.status] ?? task.status} - {formatDate(task.dueAt)}
            {task.assignedTo ? ` - ${task.assignedTo}` : ""}
          </p>
          {task.notes ? <p className="text-[11px] opacity-80">{task.notes}</p> : null}
        </div>
        <div className="flex gap-2">
          <form action={updateTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="status" value={isCompleted ? "open" : "completed"} />
            <SubmitButton
              className={`rounded-full px-3 py-1.5 font-medium ${
                isCompleted ? "border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              }`}
              pendingLabel="Updating..."
            >
              {isCompleted ? "Reopen" : "Complete"}
            </SubmitButton>
          </form>
          <form action={deleteTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <SubmitButton className="rounded-full border border-rose-200 px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50" pendingLabel="Removing...">
              Delete
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ContactsListClient({ contacts }: { contacts: ContactSummary[] }) {
  return (
    <ul className="space-y-4">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </ul>
  );
}
