import "dotenv/config";
import Module from "node:module";
import path from "node:path";

function registerAliases() {
  const originalResolve = (Module as unknown as { _resolveFilename: Module["_resolveFilename"] })._resolveFilename;
  (Module as unknown as { _resolveFilename: Module["_resolveFilename"] })._resolveFilename = function (
    request: string,
    parent: any,
    isMain: boolean,
    options: any
  ) {
    if (request.startsWith("@/")) {
      const absolute = path.resolve("apps/api/src", request.slice(2));
      return originalResolve.call(this, absolute, parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce(limit: number) {
  registerAliases();
  const { processOutboxBatch } = await import("../apps/api/src/lib/outbox-processor");
  const stats = await processOutboxBatch({ limit });
  console.log(JSON.stringify({ ok: true, ...stats }, null, 2));
  return stats;
}

async function main() {
  const limit = Number(process.env["OUTBOX_BATCH_SIZE"] ?? 10);
  const pollIntervalMs = Number(process.env["OUTBOX_POLL_INTERVAL_MS"] ?? 0);

  if (pollIntervalMs > 0) {
    // Continuous polling loop
    while (true) {
      const stats = await runOnce(limit);
      if (stats.total === 0) {
        await sleep(pollIntervalMs);
      }
    }
  } else {
    await runOnce(limit);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

