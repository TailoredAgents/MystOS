import { randomUUID } from "node:crypto";

const envRunId = process.env["E2E_RUN_ID"]?.trim();
const generatedRunId = `run-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const runId = envRunId && envRunId.length > 0 ? envRunId : generatedRunId;

process.env["E2E_RUN_ID"] = runId;

export function getRunId(): string {
  return runId;
}

export function formatTag(label: string): string {
  return `e2e+${label}-${runId}`;
}
