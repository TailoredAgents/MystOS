import { promises as fs } from "node:fs";
import path from "node:path";
import type { TestInfo } from "@playwright/test";

const services = ["site", "api", "worker"] as const;
const maxLines = 200;

export async function attachServiceLogs(testInfo: TestInfo): Promise<void> {
  await Promise.all(
    services.map(async (service) => {
      const logPath = path.resolve(process.cwd(), `artifacts/e2e/logs/${service}.log`);
      try {
        const contents = await fs.readFile(logPath, "utf8");
        const tail = tailLines(contents, maxLines);
        await testInfo.attach(`${service}-log`, {
          body: tail,
          contentType: "text/plain"
        });
      } catch {
        // ignore missing logs
      }
    })
  );
}

function tailLines(contents: string, lineCount: number): string {
  const lines = contents.split(/\r?\n/);
  return lines.slice(Math.max(lines.length - lineCount, 0)).join("\n");
}
