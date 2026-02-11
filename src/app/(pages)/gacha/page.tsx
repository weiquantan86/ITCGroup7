import GachaClient from "./GachaClient";

export default function GachaPage() {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
          <div className="w-full h-[800px] rounded-[32px] border border-slate-200/20 bg-[#0b1016]/80 shadow-[0_0_52px_rgba(70,120,210,0.22)] overflow-hidden">
             <GachaClient />
          </div>
        </div>
      </div>
    </main>
  );
}
