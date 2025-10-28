import React, { type ReactElement } from "react";
import { callAdminApi } from "../lib/api";
import PipelineBoardClient from "./PipelineBoardClient";
import type { PipelineResponse } from "./pipeline.types";

export async function PipelineSection(): Promise<ReactElement> {
  const response = await callAdminApi("/api/admin/crm/pipeline");
  if (!response.ok) {
    throw new Error("Failed to load pipeline");
  }

  const payload = (await response.json()) as PipelineResponse;
  const totalContacts = payload.lanes.reduce((sum, lane) => sum + lane.contacts.length, 0);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-primary-900">Pipeline</h2>
        <p className="text-xs text-neutral-600">
          Drag contacts between stages or use the inline controls to keep their status up to date. Each card links back to the contact record for quick
          follow-up.
        </p>
      </header>

      {totalContacts === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
          No contacts in the pipeline yet. Create contacts to get started.
        </p>
      ) : (
        <PipelineBoardClient stages={payload.stages} lanes={payload.lanes} />
      )}
    </section>
  );
}
