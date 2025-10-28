'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { updatePipelineStageAction } from "../actions";
import type { PipelineContact, PipelineLane } from "./pipeline.types";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost"
};

function labelForStage(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function sortContacts(contacts: PipelineContact[]): PipelineContact[] {
  return [...contacts].sort((a, b) => {
    const aTime = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const bTime = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return bTime - aTime;
  });
}

function normalizeBoard(lanes: PipelineLane[]): PipelineLane[] {
  return lanes.map((lane) => ({
    stage: lane.stage,
    contacts: sortContacts(lane.contacts)
  }));
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "No recent activity";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "No recent activity";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(time));
}

type PipelineBoardClientProps = {
  stages: string[];
  lanes: PipelineLane[];
};

export default function PipelineBoardClient({ stages, lanes }: PipelineBoardClientProps) {
  const [board, setBoard] = useState<PipelineLane[]>(() => normalizeBoard(lanes));
  const [dragging, setDragging] = useState<{ id: string; stage: string } | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBoard(normalizeBoard(lanes));
  }, [lanes]);

  const contactLookup = useMemo(() => {
    const map = new Map<string, PipelineContact>();
    for (const lane of board) {
      for (const contact of lane.contacts) {
        map.set(contact.id, contact);
      }
    }
    return map;
  }, [board]);

  function moveContact(contactId: string, targetStage: string) {
    setBoard((current) => {
      const contact = contactLookup.get(contactId);
      if (!contact) return current;
      if (contact.pipeline.stage === targetStage) return current;

      const updatedContact: PipelineContact = {
        ...contact,
        pipeline: {
          ...contact.pipeline,
          stage: targetStage,
          updatedAt: new Date().toISOString()
        }
      };

    const stripped = current.map((lane) => ({
      ...lane,
      contacts: lane.contacts.filter((c) => c.id !== contactId)
    }));

    const targetIndex = stripped.findIndex((lane) => lane.stage === targetStage);
    if (targetIndex === -1) {
      return current;
    }

    const targetLane = stripped[targetIndex];
    if (!targetLane) {
      return current;
    }

    stripped[targetIndex] = {
      ...targetLane,
      contacts: sortContacts([...targetLane.contacts, updatedContact])
    };

    return stripped;
  });
}

  function handleDrop(event: React.DragEvent<HTMLDivElement>, stage: string) {
    event.preventDefault();
    setHoverStage(null);

    let contactId: string | null = null;
    try {
      const raw = event.dataTransfer.getData("application/json");
      if (raw) {
        const parsed = JSON.parse(raw) as { contactId?: string };
        contactId = parsed.contactId ?? null;
      }
    } catch {
      // ignore
    }

    if (!contactId && dragging) {
      contactId = dragging.id;
    }

    if (!contactId) return;
    if (dragging?.stage === stage) return;

    moveContact(contactId, stage);
    setDragging(null);

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("stage", stage);
    startTransition(() => updatePipelineStageAction(formData));
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>, stage: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setHoverStage(stage);
  }

  function handleDragStart(contact: PipelineContact, stage: string, event: React.DragEvent<HTMLDivElement>) {
    setDragging({ id: contact.id, stage });
    try {
      event.dataTransfer.setData("application/json", JSON.stringify({ contactId: contact.id }));
      event.dataTransfer.effectAllowed = "move";
    } catch {
      // ignore
    }
  }

  function handleDragEnd() {
    setDragging(null);
    setHoverStage(null);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stages.map((stage) => {
        const lane = board.find((item) => item.stage === stage) ?? { stage, contacts: [] };
        const isHover = hoverStage === stage;
        return (
          <div
            key={stage}
            onDragOver={(event) => handleDragOver(event, stage)}
            onDrop={(event) => handleDrop(event, stage)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setHoverStage(null);
              }
            }}
            className={`flex min-h-[260px] flex-col gap-3 rounded-lg border p-3 ${
              isHover ? "border-primary-400 bg-primary-50" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary-900">{labelForStage(stage)}</h3>
              <span className="text-xs text-neutral-500">{lane.contacts.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-3">
              {lane.contacts.length === 0 ? (
                <p className="rounded-md border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-400">Drop a contact here</p>
              ) : (
                lane.contacts.map((contact) => (
                  <article
                    key={contact.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(event) => handleDragStart(contact, stage, event)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab rounded-md border bg-white p-3 text-xs shadow-sm transition ${
                      dragging?.id === contact.id ? "opacity-60" : "hover:border-primary-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-primary-900">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Updated {formatShortDate(contact.lastActivityAt)} · {contact.openTasks} open tasks
                        </p>
                      </div>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-600">
                        {labelForStage(contact.pipeline.stage)}
                      </span>
                    </div>
                    {contact.property ? (
                      <p className="mt-2 text-[11px] text-neutral-600">
                        {contact.property.addressLine1}, {contact.property.city}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <a
                        className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-700"
                        href={`/team?tab=contacts&q=${encodeURIComponent(`${contact.firstName} ${contact.lastName}`.trim())}`}
                      >
                        View contact
                      </a>
                      <a
                        className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-700"
                        href={`/team?tab=quotes&contactId=${encodeURIComponent(contact.id)}`}
                      >
                        Create quote
                      </a>
                    </div>
                    <form
                      action={updatePipelineStageAction}
                      className="mt-3 flex items-center gap-2 text-[11px]"
                      onSubmit={() => setHoverStage(null)}
                    >
                      <input type="hidden" name="contactId" value={contact.id} />
                      <select
                        name="stage"
                        defaultValue={contact.pipeline.stage}
                        className="rounded-md border border-neutral-300 px-2 py-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {stages.map((option) => (
                          <option key={option} value={option}>
                            {labelForStage(option)}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-700"
                        pendingLabel="Saving..."
                      >
                        Update
                      </SubmitButton>
                    </form>
                  </article>
                ))
              )}
            </div>
          </div>
        );
      })}
      {isPending ? (
        <div className="col-span-full text-center text-xs text-neutral-500">Saving updates…</div>
      ) : null}
    </div>
  );
}
