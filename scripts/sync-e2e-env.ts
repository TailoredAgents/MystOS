import { promises as fs } from "node:fs";
import path from "node:path";

type Mapping = {
  src: string;
  dest: string;
};

const copies: Mapping[] = [
  { src: ".env.e2e", dest: ".env" },
  { src: "apps/site/.env.e2e.local", dest: "apps/site/.env.local" },
  { src: "apps/api/.env.e2e.local", dest: "apps/api/.env.local" }
];

async function copy(mapping: Mapping) {
  const cwd = process.cwd();
  const sourcePath = path.resolve(cwd, mapping.src);
  const destPath = path.resolve(cwd, mapping.dest);

  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(`Missing source env file: ${mapping.src}`);
  }

  await fs.copyFile(sourcePath, destPath);
  console.info(`[e2e:env] ${mapping.src} -> ${mapping.dest}`);
}

async function main() {
  await Promise.all(copies.map(copy));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
