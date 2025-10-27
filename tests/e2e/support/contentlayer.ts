import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const serviceIndexPath = path.resolve(
  process.cwd(),
  "apps/site/.contentlayer/generated/Service/_index.json"
);

function hasServiceIndex(): boolean {
  try {
    if (!fs.existsSync(serviceIndexPath)) {
      return false;
    }
    const contents = fs.readFileSync(serviceIndexPath, "utf-8");
    const parsed = JSON.parse(contents) as unknown;
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export async function ensureContentlayerGenerated(): Promise<void> {
  if (hasServiceIndex()) {
    return;
  }

  console.info("[e2e] Contentlayer artifacts missing; running contentlayer build for apps/site...");
  const result = spawnSync("pnpm", ["--filter", "site", "exec", "contentlayer", "build"], {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error("[e2e] Failed to build contentlayer data for apps/site.");
  }

  if (!hasServiceIndex()) {
    throw new Error("[e2e] Contentlayer build completed but no service data was generated.");
  }
}
