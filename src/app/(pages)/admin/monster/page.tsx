import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import AdminMonsterClient from "./AdminMonsterClient";

type MonsterRow = {
  id: string;
  inSource: boolean;
  inPublic: boolean;
  glbFiles: string[];
  previewPath: string | null;
};

type MonsterGenerationSummary = {
  scriptCount: number;
  failedScripts: Array<{
    scriptPath: string;
    error: string;
  }>;
};

const execFileAsync = promisify(execFile);

const listDirectoryNames = async (absolutePath: string) => {
  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [] as string[];
  }
};

const listGlbFiles = async (absolutePath: string) => {
  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".glb"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [] as string[];
  }
};

const regenerateMonsterGlbs = async (): Promise<MonsterGenerationSummary> => {
  const sourceRoot = path.join(process.cwd(), "src", "app", "asset", "entity", "monster");
  const failedScripts: MonsterGenerationSummary["failedScripts"] = [];
  let scriptCount = 0;

  const monsterDirectories = await listDirectoryNames(sourceRoot);
  for (const monsterId of monsterDirectories) {
    const monsterDirPath = path.join(sourceRoot, monsterId);
    let entries;
    try {
      entries = await readdir(monsterDirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    const scripts = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          /^gen_.*_glb\.mjs$/i.test(entry.name)
      )
      .map((entry) => path.join(monsterDirPath, entry.name))
      .sort((a, b) => a.localeCompare(b));

    for (const scriptPath of scripts) {
      scriptCount += 1;
      try {
        await execFileAsync(process.execPath, [scriptPath], {
          cwd: process.cwd(),
          windowsHide: true,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error";
        failedScripts.push({
          scriptPath: path.relative(process.cwd(), scriptPath),
          error: message,
        });
      }
    }
  }

  return {
    scriptCount,
    failedScripts,
  };
};

const loadMonsters = async () => {
  const sourceRoot = path.join(process.cwd(), "src", "app", "asset", "entity", "monster");
  const publicRoot = path.join(process.cwd(), "public", "assets", "monsters");

  const sourceMonsterIds = await listDirectoryNames(sourceRoot);
  const publicMonsterIds = await listDirectoryNames(publicRoot);

  const allIds = Array.from(new Set([...sourceMonsterIds, ...publicMonsterIds])).sort((a, b) =>
    a.localeCompare(b)
  );

  const rows: MonsterRow[] = [];
  for (const id of allIds) {
    const glbFiles = await listGlbFiles(path.join(publicRoot, id));
    rows.push({
      id,
      inSource: sourceMonsterIds.includes(id),
      inPublic: publicMonsterIds.includes(id),
      glbFiles,
      previewPath: glbFiles[0] ? `/assets/monsters/${id}/${glbFiles[0]}` : null,
    });
  }
  return rows;
};

export default async function AdminMonsterPage() {
  noStore();
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    redirect("/userSystem/login");
  }

  const generationSummary = await regenerateMonsterGlbs();
  const monsters = await loadMonsters();

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Monster</h1>
            <p className="text-slate-300">All currently available monsters are listed here.</p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm transition-colors hover:bg-slate-700"
          >
            Back
          </Link>
        </header>

        {generationSummary.failedScripts.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-200">
            Auto-regenerated monster GLBs: {generationSummary.scriptCount} script(s) executed.
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
            <p>
              Auto-regeneration finished with errors (
              {generationSummary.failedScripts.length}/{generationSummary.scriptCount}).
            </p>
            {generationSummary.failedScripts.map((failure) => (
              <p key={failure.scriptPath} className="font-mono break-all">
                {failure.scriptPath}: {failure.error}
              </p>
            ))}
          </div>
        )}

        {monsters.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
            No monsters found.
          </div>
        ) : (
          <AdminMonsterClient monsters={monsters} />
        )}
      </main>
    </div>
  );
}
