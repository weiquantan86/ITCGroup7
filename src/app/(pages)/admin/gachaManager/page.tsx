import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import RateManager from "@/app/components/gachaHandler/RateManager";
import GachaTest from "@/app/components/gachaHandler/GachaTest";

export default async function AdminGachaManagerPage() {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    redirect("/userSystem/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Gacha Manager</h1>
            <p className="text-slate-300">
              Manage snack drop rates and default reward behavior.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm transition-colors hover:bg-slate-700"
          >
            Back
          </Link>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
          <div className="min-w-0">
            <RateManager />
          </div>
          <div className="min-w-0">
            <GachaTest />
          </div>
        </div>
      </main>
    </div>
  );
}
