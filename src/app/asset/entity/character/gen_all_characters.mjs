import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const charactersDir = here;
const projectRoot = resolve(charactersDir, "..", "..", "..", "..", "..");

const run = (file) =>
  new Promise((resolve, reject) => {
    execFile("node", [file], { cwd: projectRoot }, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (err) reject(err);
      else resolve();
    });
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
generators.sort();

if (generators.length === 0) {
  console.log("No character generators found in app/asset/entity/character/");
} else {
  console.log(`Generating ${generators.length} character(s)...`);
  for (const file of generators) {
    console.log(`- ${basename(file)}`);
    await run(file);
  }
}
