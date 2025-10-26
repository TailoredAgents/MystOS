import { promises as fs } from "node:fs";
import path from "node:path";

interface PlaywrightResult {
  suites?: PlaywrightResult[];
  tests?: Array<{
    title: string;
    outcome: string;
    annotations?: Array<{ type: string; description?: string }>;
    duration?: number;
  }>;
}

async function readJsonReport(filePath: string): Promise<PlaywrightResult> {
  const absolute = path.resolve(process.cwd(), filePath);
  const data = await fs.readFile(absolute, "utf8");
  return JSON.parse(data) as PlaywrightResult;
}

function flattenSuites(result: PlaywrightResult): PlaywrightResult["tests"] {
  const collected: PlaywrightResult["tests"] = [];
  if (result.tests) {
    collected.push(...result.tests);
  }
  if (result.suites) {
    result.suites.forEach((suite) => {
      const nested = flattenSuites(suite);
      if (nested) {
        collected.push(...nested);
      }
    });
  }
  return collected;
}

function summarize(tests: NonNullable<PlaywrightResult["tests"]>) {
  const summary = {
    total: tests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    durationMs: 0
  };

  const flakyTests: string[] = [];
  const failedTests: string[] = [];

  tests.forEach((test) => {
    summary.durationMs += test.duration ?? 0;
    switch (test.outcome) {
      case "expected":
        summary.passed += 1;
        break;
      case "skipped":
        summary.skipped += 1;
        break;
      case "flaky":
        summary.flaky += 1;
        flakyTests.push(test.title);
        break;
      default:
        summary.failed += 1;
        failedTests.push(test.title);
        break;
    }
  });

  return { summary, flakyTests, failedTests };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm report:e2e <json-report-path>");
    process.exit(1);
  }

  const report = await readJsonReport(filePath).catch((error) => {
    console.error(`[e2e:report] Failed to read ${filePath}`, error);
    process.exit(1);
  });

  const tests = flattenSuites(report) ?? [];
  if (!tests.length) {
    console.warn("[e2e:report] No tests found in report");
    return;
  }

  const { summary, flakyTests, failedTests } = summarize(tests);
  console.log(`E2E Summary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.flaky} flaky`);
  console.log(`Total duration: ${(summary.durationMs / 1000).toFixed(1)}s`);

  if (flakyTests.length) {
    console.log("Flaky tests:");
    flakyTests.forEach((title) => console.log(`  - ${title}`));
  }

  if (failedTests.length) {
    console.log("Failed tests:");
    failedTests.forEach((title) => console.log(`  - ${title}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
