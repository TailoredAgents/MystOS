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

const STAGE_ACCENTS: Record<string, { lane: string; badge: string }> = {
  new: { lane: "border-l-4 border-blue-300 bg-blue-50/70", badge: "bg-blue-100 text-blue-700" },
  contacted: { lane: "border-l-4 border-sky-300 bg-sky-50/70", badge: "bg-sky-100 text-sky-700" },
  qualified: { lane: "border-l-4 border-amber-300 bg-amber-50/70", badge: "bg-amber-100 text-amber-700" },
  quoted: { lane: "border-l-4 border-indigo-300 bg-indigo-50/70", badge: "bg-indigo-100 text-indigo-700" },
  won: { lane: "border-l-4 border-emerald-300 bg-emerald-50/70", badge: "bg-emerald-100 text-emerald-700" },
  lost: { lane: "border-l-4 border-rose-300 bg-rose-50/70", badge: "bg-rose-100 text-rose-700" },
  default: { lane: "border-l-4 border-slate-200 bg-white/90", badge: "bg-slate-100 text-slate-600" }
};

function labelForStage(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function accentForStage(stage: string): { lane: string; badge: string } {
  return STAGE_ACCENTS[stage] ?? STAGE_ACCENTS["default"];
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
      if (targetIndex === -1) return current;

      const targetLane = stripped[targetIndex];
      if (!targetLane) return current;

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

    if (!contactId || dragging?.stage === stage) return;

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
            className={`flex min-h-[280px] flex-col gap-4 rounded-3xl border border-slate-200 bg-white/75 p-4 shadow-lg shadow-slate-200/60 transition ${
              isHover ? "border-primary-400 ring-2 ring-primary-200/60" : ""
            }`}
          >
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{labelForStage(stage)}</h3>
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs text-slate-500">{lane.contacts.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-3">
              {lane.contacts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-xs text-slate-400">
                  Drop a contact here
                </p>
              ) : (
                lane.contacts.map((contact) => {
                  const accent = accentForStage(contact.pipeline.stage);
                  return (
                    <article
                      key={contact.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(event: React.DragEvent<HTMLDivElement>) => handleDragStart(contact, stage, event)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab rounded-2xl border border-slate-200 p-4 text-xs shadow-md transition ${
                        dragging?.id === contact.id ? "opacity-60" : "hover:shadow-lg hover:border-primary-200"
                      } ${accent.lane}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Updated {formatShortDate(contact.lastActivityAt)} · {contact.openTasks} open tasks
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${accent.badge}`}>
                          {labelForStage(contact.pipeline.stage)}
                        </span>
                      </div>
                      {contact.property ? (
                        <p className="mt-2 text-[11px] text-slate-600">
                          {contact.property.addressLine1}, {contact.property.city}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <a
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-primary-300 hover:text-primary-700"
                          href={`/team?tab=contacts&q=${encodeURIComponent(`${contact.firstName} ${contact.lastName}`.trim())}`}
                        >
                          View contact
                        </a>
                        <a
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-primary-300 hover:text-primary-700"
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
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {stages.map((option) => (
                            <option key={option} value={option}>
                              {labelForStage(option)}
                            </option>
                          ))}
                        </select>
                        <SubmitButton
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-primary-300 hover:text-primary-700"
                          pendingLabel="Saving..."
                        >
                          Update
                        </SubmitButton>
                      </form>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      {isPending ? <div className="col-span-full text-center text-xs text-slate-500">Saving updates…</div> : null}
    </div>
  );
}
