import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

let initialized = false;

export function ensureE2EEnv(): NodeJS.ProcessEnv {
  if (initialized) {
    return process.env;
  }

  const envPath = path.resolve(process.cwd(), ".env.e2e");
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  } else {
    console.warn(`[e2e] .env.e2e not found at ${envPath}; relying on ambient environment variables.`);
  }

  initialized = true;
  return process.env;
}

export function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required E2E environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnvVar(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}
