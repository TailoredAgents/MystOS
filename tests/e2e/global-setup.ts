import type { FullConfig } from "@playwright/test";
import { ensureE2EEnv, getEnvVar } from "./support/env";
import { bootstrapAdminStorage, bootstrapVisitorStorage } from "./support/auth";
import { runE2ESeed } from "./support/seed";
import { waitForHealthcheck } from "./support/health";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  ensureE2EEnv();

  await runE2ESeed();

  const siteBase = getEnvVar("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  const apiBase = getEnvVar("API_BASE_URL", "http://localhost:3001");

  await Promise.all([
    waitForHealthcheck(new URL("/api/healthz", siteBase).toString(), { service: "site" }),
    waitForHealthcheck(new URL("/api/healthz", apiBase).toString(), { service: "api" })
  ]);

  await Promise.all([
    bootstrapVisitorStorage("tests/e2e/storage/visitor.json"),
    bootstrapAdminStorage("tests/e2e/storage/admin.json")
  ]);
}
