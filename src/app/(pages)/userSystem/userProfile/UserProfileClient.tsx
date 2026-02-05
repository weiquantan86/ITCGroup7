"use client";

import { useState } from "react";

type UserProfileClientProps = {
  username: string;
  createdAtLabel: string;
  selfIntroduction: string | null;
};

export default function UserProfileClient({
  username,
  createdAtLabel,
  selfIntroduction,
}: UserProfileClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [intro, setIntro] = useState(selfIntroduction ?? "");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfIntroduction: intro }),
      });
      if (!res.ok) {
        throw new Error("Save failed");
      }
      setStatus("Saved.");
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      setStatus("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Username
          </p>
          <div className="mt-2 text-3xl font-semibold text-slate-100">
            {username}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Created
          </p>
          <div className="mt-2 text-lg font-semibold text-slate-200">
            {createdAtLabel}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-[20px] border border-slate-200/15 bg-[#101722]/80 p-6 shadow-[0_0_18px_rgba(90,140,220,0.16)]">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Self Introduction
        </div>

        {isEditing ? (
          <textarea
            value={intro}
            onChange={(event) => setIntro(event.target.value)}
            className="mt-4 min-h-[180px] flex-1 resize-none rounded-[16px] border border-slate-200/20 bg-[#0b1119]/90 p-4 text-sm text-slate-100 outline-none ring-0 transition focus:border-slate-100/40"
          />
        ) : (
          <p className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-200/90">
            {intro.trim().length > 0
              ? intro
              : "No self introduction yet."}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-400">{status}</span>
          {isEditing ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-full border border-slate-200/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-slate-200/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
