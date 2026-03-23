import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import AdminTestClient from "./AdminTestClient";

type AdminTestMonsterOption = {
  id: string;
  label: string;
  path: string;
};

const toMonsterLabel = (monsterId: string) => {
  const normalized = monsterId
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!normalized) {
    return monsterId;
  }
  return normalized
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const loadAdminTestMonsters = async (): Promise<AdminTestMonsterOption[]> => {
  const publicRoot = path.join(process.cwd(), "public", "assets", "monsters");
  let directories: Dirent[] = [];
  try {
    directories = await readdir(publicRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const options: AdminTestMonsterOption[] = [];
  for (let i = 0; i < directories.length; i += 1) {
    const directory = directories[i];
    if (!directory.isDirectory()) continue;
    const monsterId = directory.name;
    const monsterDirectory = path.join(publicRoot, monsterId);
    let files: Dirent[] = [];
    try {
      files = await readdir(monsterDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    const glb = files
      .filter((file) => file.isFile() && file.name.toLowerCase().endsWith(".glb"))
      .map((file) => file.name)
      .sort((a, b) => a.localeCompare(b))[0];
    if (!glb) continue;

    options.push({
      id: monsterId,
      label: toMonsterLabel(monsterId),
      path: `/assets/monsters/${monsterId}/${glb}`,
    });
  }

  options.sort((a, b) => a.id.localeCompare(b.id));
  return options;
};

export default async function AdminTestPage() {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    redirect("/userSystem/login");
  }

  const monsters = await loadAdminTestMonsters();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Test</h1>
            <p className="text-sm text-slate-300">
              Adam is fixed as the player character. Select a monster to respawn at center.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm transition-colors hover:bg-slate-700"
          >
            Back
          </Link>
        </header>

        <AdminTestClient monsters={monsters} />
      </div>
    </main>
  );
}
