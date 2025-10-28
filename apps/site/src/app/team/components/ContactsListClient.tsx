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

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost"
};

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

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-primary-900">{contactState.name}</h3>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary-700">
              {stageLabel(contactState.pipeline.stage)}
            </span>
          </div>
          <div className="text-xs text-neutral-600 space-y-0.5">
            {contactState.email ? <p>{contactState.email}</p> : null}
            {contactState.phone ? <p>{contactState.phone}</p> : null}
            <p>Last activity: {formatDateTime(contactState.lastActivityAt)}</p>
            <p>
              Stats: {contactState.stats.appointments} appointments · {contactState.stats.quotes} quotes
            </p>
          </div>
          {editingContact ? (
            <form
              action={updateContactAction}
              className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2"
              onSubmit={() => setEditingContact(false)}
            >
              <input type="hidden" name="contactId" value={contactState.id} />
              <label className="flex flex-col gap-1">
                <span>First name</span>
                <input name="firstName" defaultValue={contactState.firstName} required className="rounded-md border border-neutral-300 px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Last name</span>
                <input name="lastName" defaultValue={contactState.lastName} required className="rounded-md border border-neutral-300 px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Email</span>
                <input name="email" defaultValue={contactState.email ?? ""} type="email" className="rounded-md border border-neutral-300 px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Phone</span>
                <input name="phone" defaultValue={contactState.phone ?? ""} className="rounded-md border border-neutral-300 px-2 py-1.5" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <SubmitButton className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white" pendingLabel="Saving...">
                  Save changes
                </SubmitButton>
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700"
                  onClick={() => setEditingContact(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-neutral-600">
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-3 py-1 text-neutral-700"
            onClick={() => setEditingContact((prev) => !prev)}
          >
            {editingContact ? "Close edit" : "Edit contact"}
          </button>
          <form action={deleteContactAction} className="inline">
            <input type="hidden" name="contactId" value={contactState.id} />
            <SubmitButton className="rounded-md border border-rose-300 px-3 py-1 text-rose-700" pendingLabel="Removing...">
              Delete
            </SubmitButton>
          </form>
          <a className="rounded-md border border-neutral-300 px-3 py-1 text-neutral-700" href={teamLink("quotes", { contactId: contactState.id })}>
            Create quote
          </a>
          <a className="rounded-md border border-neutral-300 px-3 py-1 text-neutral-700" href={teamLink("myday", { contactId: contactState.id })}>
            Schedule visit
          </a>
          <a
            className={`rounded-md border px-3 py-1 ${mapsLink ? "border-neutral-300 text-neutral-700" : "pointer-events-none border-neutral-200 text-neutral-400"}`}
            href={mapsLink ?? "#"}
            target="_blank"
            rel="noreferrer"
          >
            Open in Maps
          </a>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-xs text-neutral-700">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary-900">Properties</h4>
            {addingProperty ? null : (
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
                onClick={() => {
                  setAddingProperty(true);
                  setEditingPropertyId(null);
                }}
              >
                Add property
              </button>
            )}
          </div>
          <div className="space-y-2">
            {contactState.properties.map((property) => (
              <div key={property.id} className="rounded-md border border-neutral-200 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-neutral-800">
                      {property.addressLine1}
                      {property.addressLine2 ? `, ${property.addressLine2}` : ""}
                    </p>
                    <p className="text-neutral-500">
                      {property.city}, {property.state} {property.postalCode}
                    </p>
                    <p className="text-neutral-400">Added {formatDateTime(property.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-700"
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
                      <SubmitButton className="rounded-md border border-rose-300 px-2 py-1 text-rose-700" pendingLabel="Removing...">
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </div>
                {editingPropertyId === property.id ? (
                  <form
                    action={updatePropertyAction}
                    className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
                    onSubmit={() => setEditingPropertyId(null)}
                  >
                    <input type="hidden" name="contactId" value={contactState.id} />
                    <input type="hidden" name="propertyId" value={property.id} />
                    <label className="flex flex-col gap-1">
                      <span>Address line 1</span>
                      <input name="addressLine1" defaultValue={property.addressLine1} required className="rounded-md border border-neutral-300 px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Address line 2</span>
                      <input name="addressLine2" defaultValue={property.addressLine2 ?? ""} className="rounded-md border border-neutral-300 px-2 py-1" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>City</span>
                      <input name="city" defaultValue={property.city} required className="rounded-md border border-neutral-300 px-2 py-1" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span>State</span>
                        <input name="state" defaultValue={property.state} required maxLength={2} className="rounded-md border border-neutral-300 px-2 py-1 uppercase" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>Postal code</span>
                        <input name="postalCode" defaultValue={property.postalCode} required className="rounded-md border border-neutral-300 px-2 py-1" />
                      </label>
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <SubmitButton className="rounded-md bg-primary-700 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">
                        Save property
                      </SubmitButton>
                      <button
                        type="button"
                        className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700"
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
              className="rounded-md border border-dashed border-neutral-300 p-3"
              onSubmit={() => setAddingProperty(false)}
            >
              <input type="hidden" name="contactId" value={contactState.id} />
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span>Address line 1</span>
                  <input name="addressLine1" required className="rounded-md border border-neutral-300 px-2 py-1" />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Address line 2</span>
                  <input name="addressLine2" className="rounded-md border border-neutral-300 px-2 py-1" />
                </label>
                <label className="flex flex-col gap-1">
                  <span>City</span>
                  <input name="city" required className="rounded-md border border-neutral-300 px-2 py-1" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span>State</span>
                    <input name="state" required maxLength={2} className="rounded-md border border-neutral-300 px-2 py-1 uppercase" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Postal code</span>
                    <input name="postalCode" required className="rounded-md border border-neutral-300 px-2 py-1" />
                  </label>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <SubmitButton className="rounded-md bg-primary-700 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">
                  Save property
                </SubmitButton>
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700"
                  onClick={() => setAddingProperty(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="rounded-md border border-neutral-200 p-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary-900">Tasks</h4>
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-700"
              onClick={() => setShowTaskForm((prev) => !prev)}
            >
              {showTaskForm ? "Close" : "Add task"}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {contactState.tasks.length === 0 ? (
              <p className="text-xs text-neutral-500">No tasks yet.</p>
            ) : (
              <>
                {openTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
                {completedTasks.length > 0 ? (
                  <details className="rounded-md border border-neutral-200 p-2 text-neutral-500">
                    <summary className="cursor-pointer text-xs font-medium text-neutral-600">
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
              className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2"
              onSubmit={() => setShowTaskForm(false)}
            >
              <input type="hidden" name="contactId" value={contactState.id} />
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span>Title</span>
                <input name="title" required className="rounded-md border border-neutral-300 px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Due date</span>
                <input name="dueAt" type="date" className="rounded-md border border-neutral-300 px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span>Assignee</span>
                <input name="assignedTo" placeholder="Optional" className="rounded-md border border-neutral-300 px-2 py-1.5" />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <SubmitButton className="rounded-md bg-primary-700 px-3 py-1 text-xs font-semibold text-white" pendingLabel="Saving...">
                  Add task
                </SubmitButton>
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700"
                  onClick={() => setShowTaskForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  const isCompleted = task.status === "completed";
  return (
    <div className={`rounded-md border px-3 py-2 ${isCompleted ? "border-neutral-200 bg-neutral-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-xs">
          <p className={`font-medium ${isCompleted ? "text-neutral-600" : "text-emerald-900"}`}>{task.title}</p>
          <p className="text-neutral-500">
            {taskStatusLabel[task.status] ?? task.status} · {formatDate(task.dueAt)}
            {task.assignedTo ? ` · ${task.assignedTo}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={updateTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="status" value={isCompleted ? "open" : "completed"} />
            <SubmitButton
              className={`rounded-md border px-2 py-1 text-xs ${
                isCompleted ? "border-neutral-300 text-neutral-600" : "border-emerald-300 text-emerald-700"
              }`}
              pendingLabel="Updating..."
            >
              {isCompleted ? "Reopen" : "Complete"}
            </SubmitButton>
          </form>
          <form action={deleteTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <SubmitButton className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" pendingLabel="Removing...">
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
    <ul className="space-y-3">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </ul>
  );
}
