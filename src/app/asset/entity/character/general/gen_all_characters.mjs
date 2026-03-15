import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const charactersDir = resolve(here, "..");
const projectRoot = resolve(charactersDir, "..", "..", "..", "..", "..");
const jsonMode = process.argv.includes("--json");

const toErrorMessage = (error) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
};

const run = (file) =>
  new Promise((resolvePromise, rejectPromise) => {
    execFile(
      process.execPath,
      [file],
      { cwd: projectRoot, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          rejectPromise(new Error(stderr.trim() || stdout.trim() || err.message));
          return;
        }
        resolvePromise({ stdout, stderr });
      }
    );
  });

const entries = await readdir(charactersDir, { withFileTypes: true });
const generators = [];

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const dir = join(charactersDir, entry.name);
  const files = await readdir(dir, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile()) continue;
    const name = file.name;
    if (name.startsWith("gen_") && name.endsWith("_glb.mjs")) {
      generators.push(join(dir, name));
    }
  }
}

generators.sort((left, right) => left.localeCompare(right));

const summary = {
  scriptCount: 0,
  failedScripts: [],
};

if (!jsonMode) {
  if (generators.length === 0) {
    console.log("No character generators found in app/asset/entity/character/");
  } else {
    console.log(`Generating ${generators.length} character(s)...`);
  }
}

for (const file of generators) {
  summary.scriptCount += 1;
  if (!jsonMode) {
    console.log(`- ${basename(file)}`);
  }
  try {
    const result = await run(file);
    if (!jsonMode) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
  } catch (error) {
    const failure = {
      scriptPath: relative(projectRoot, file),
      error: toErrorMessage(error),
    };
    summary.failedScripts.push(failure);
    if (!jsonMode) {
      console.error(`  failed: ${failure.error}`);
    }
  }
}

if (jsonMode) {
  process.stdout.write(JSON.stringify(summary));
} else if (summary.failedScripts.length > 0) {
  process.exitCode = 1;
}
