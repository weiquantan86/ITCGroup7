import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const toolsDir = here;
const projectRoot = resolve(toolsDir, "..", "..");

const run = (file) =>
  new Promise((resolve, reject) => {
    execFile("node", [file], { cwd: projectRoot }, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (err) reject(err);
      else resolve();
    });
  });

const entries = await readdir(toolsDir, { withFileTypes: true });
const generators = entries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name.startsWith("gen_") && name.endsWith("_glb.mjs"))
  .sort();

if (generators.length === 0) {
  console.log("No character generators found in tools/");
} else {
  console.log(`Generating ${generators.length} character(s)...`);
  for (const file of generators) {
    const full = join(toolsDir, file);
    console.log(`- ${basename(file)}`);
    await run(full);
  }
}
