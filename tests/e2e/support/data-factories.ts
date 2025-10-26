import { randomUUID } from "node:crypto";
import { formatTag } from "./run-context";

export function uniqueEmail(label: string): string {
  const suffix = randomUUID().split("-")[0];
  return `${formatTag(label)}-${suffix}@mystos.test`;
}

export function uniquePhone(): string {
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `404555${suffix}`;
}
