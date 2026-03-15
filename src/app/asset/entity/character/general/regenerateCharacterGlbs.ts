import "server-only";

import { execFile } from "node:child_process";
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

const generationScriptPath = path.join(
  process.cwd(),
  "src",
  "app",
  "asset",
  "entity",
  "character",
  "general",
  "gen_all_characters.mjs"
);

export const regenerateCharacterGlbs =
  async (): Promise<CharacterGenerationSummary> => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [generationScriptPath, "--json"],
      {
        cwd: process.cwd(),
        windowsHide: true,
      }
    );

    const parsed = JSON.parse(stdout) as CharacterGenerationSummary;
    return {
      scriptCount: Number.isFinite(parsed?.scriptCount) ? parsed.scriptCount : 0,
      failedScripts: Array.isArray(parsed?.failedScripts)
        ? parsed.failedScripts
        : [],
    };
  };
