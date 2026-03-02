import "server-only";

import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CharacterGenerationSummary = {
  scriptCount: number;
  failedScripts: Array<{
    scriptPath: string;
    error: string;
  }>;
};

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
};

export const regenerateCharacterGlbs =
  async (): Promise<CharacterGenerationSummary> => {
    const sourceRoot = path.join(
      process.cwd(),
      "src",
      "app",
      "asset",
      "entity",
      "character"
    );
    const failedScripts: CharacterGenerationSummary["failedScripts"] = [];
    let scriptCount = 0;
    let characterDirectories;

    try {
      characterDirectories = await readdir(sourceRoot, { withFileTypes: true });
    } catch (error) {
      return {
        scriptCount,
        failedScripts: [
          {
            scriptPath: path.relative(process.cwd(), sourceRoot),
            error: toErrorMessage(error),
          },
        ],
      };
    }

    for (const entry of characterDirectories) {
      if (!entry.isDirectory()) continue;

      const characterDirPath = path.join(sourceRoot, entry.name);
      let entries;
      try {
        entries = await readdir(characterDirPath, { withFileTypes: true });
      } catch (error) {
        failedScripts.push({
          scriptPath: path.relative(process.cwd(), characterDirPath),
          error: toErrorMessage(error),
        });
        continue;
      }

      const scripts = entries
        .filter(
          (file) => file.isFile() && /^gen_.*_glb\.mjs$/i.test(file.name)
        )
        .map((file) => path.join(characterDirPath, file.name))
        .sort((a, b) => a.localeCompare(b));

      for (const scriptPath of scripts) {
        scriptCount += 1;
        try {
          await execFileAsync(process.execPath, [scriptPath], {
            cwd: process.cwd(),
            windowsHide: true,
          });
        } catch (error) {
          failedScripts.push({
            scriptPath: path.relative(process.cwd(), scriptPath),
            error: toErrorMessage(error),
          });
        }
      }
    }

    return {
      scriptCount,
      failedScripts,
    };
  };
