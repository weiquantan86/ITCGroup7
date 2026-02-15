import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    redirect("/userSystem/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Admin Interface</h1>
          <p className="text-slate-300">Access granted. Choose an admin action below.</p>
        </header>

        <section className="grid gap-3">
          <Link
            href="/admin/user"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 transition-colors hover:bg-slate-700"
          >
            Users
          </Link>
        </section>
      </main>
    </div>
  );
}
