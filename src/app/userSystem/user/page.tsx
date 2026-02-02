import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

function Panel({ children, className = "" }: PanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border border-slate-200/20 bg-[#0d1219]/90 p-5 shadow-[0_0_28px_rgba(90,140,220,0.14)] before:pointer-events-none before:absolute before:inset-[6px] before:rounded-[18px] before:border before:border-slate-200/10 before:content-[''] ${className}`}
    >
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

type MenuButtonProps = {
  label: string;
  className?: string;
};

function MenuButton({ label, className = "" }: MenuButtonProps) {
  return (
    <button
      className={`group relative w-full rounded-[20px] border border-slate-200/20 bg-[#111823]/90 px-6 py-6 text-center text-lg font-semibold tracking-wide text-slate-100 shadow-[0_0_18px_rgba(90,140,220,0.18)] transition duration-200 hover:border-slate-100/40 hover:shadow-[0_0_26px_rgba(130,190,255,0.26)] ${className}`}
    >
      <span className="relative z-10">{label}</span>
      <span className="pointer-events-none absolute inset-[6px] rounded-[16px] border border-slate-200/10 transition duration-200 group-hover:border-slate-100/25" />
    </button>
  );
}

export default function UserPage() {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-slate-200/20 bg-[#0b1016]/80 p-6 shadow-[0_0_40px_rgba(70,120,210,0.18)]">
            <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1.5fr_1fr]">
              <Panel className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between text-sm text-slate-200/90">
                  <span className="font-semibold tracking-wide">[Username][S]</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
                </div>
                <div className="grid gap-3">
                  <button className="relative w-full rounded-[18px] border border-slate-200/15 bg-[#111722]/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_12px_rgba(90,140,220,0.16)] transition duration-200 hover:border-slate-100/35 hover:shadow-[0_0_18px_rgba(120,180,255,0.25)]">
                    View my profile
                    <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-slate-200/10" />
                  </button>
                  <button className="relative w-full rounded-[18px] border border-slate-200/15 bg-[#111722]/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_12px_rgba(90,140,220,0.16)] transition duration-200 hover:border-slate-100/35 hover:shadow-[0_0_18px_rgba(120,180,255,0.25)]">
                    Log out
                    <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-slate-200/10" />
                  </button>
                </div>
              </Panel>

              <Panel className="flex h-full items-center justify-between gap-6 px-6 py-6">
                <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0d141d]/90 shadow-[0_0_14px_rgba(120,180,255,0.2)]" />
                <div className="text-center text-4xl font-semibold italic tracking-[0.2em] text-slate-100 md:text-5xl">
                  Lab 7½
                </div>
                <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0d141d]/90 shadow-[0_0_14px_rgba(120,180,255,0.2)]" />
              </Panel>

              <div className="h-full">
                <MenuButton label="Shop" className="h-full text-2xl" />
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr_1fr]">
              <Panel className="flex min-h-[520px] flex-col gap-4">
                <MenuButton label="Mech Onslaught" />
                <MenuButton label="Dragon Hunter" />
                <MenuButton label="Bluestone Colossus" />
              </Panel>

              <Panel className="flex min-h-[520px] flex-col items-center justify-center gap-6">
                <MenuButton label="Deathmatch" className="max-w-[420px]" />
                <MenuButton label="Can Wars" className="max-w-[420px]" />
              </Panel>

              <Panel className="flex min-h-[520px] flex-col gap-4">
                <MenuButton label="Character" />
                <MenuButton label="Storage" />
                <MenuButton label="Option" />
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
