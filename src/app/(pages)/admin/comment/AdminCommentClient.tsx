"use client";

import { useState } from "react";

type CommunityCommentRow = {
  id: number;
  username: string;
  comment: string;
  commented_date: string;
};

type AdminCommentClientProps = {
  initialComments: CommunityCommentRow[];
};

export default function AdminCommentClient({
  initialComments,
}: AdminCommentClientProps) {
  const [comments, setComments] = useState<CommunityCommentRow[]>(initialComments);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleDelete = async (commentId: number) => {
    if (deletingId != null) return;
    const confirmed = window.confirm("Delete this community comment?");
    if (!confirmed) return;

    setDeletingId(commentId);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/community/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete comment.");
      }

      setComments((previous) => previous.filter((item) => item.id !== commentId));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete comment."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {comments.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          No community comments found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full divide-y divide-slate-700 text-sm">
            <thead className="bg-slate-900/90 text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">ID</th>
                <th className="px-4 py-3 text-left font-semibold">Username</th>
                <th className="px-4 py-3 text-left font-semibold">Comment</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {comments.map((item) => (
                <tr key={item.id} className="bg-slate-900/30 align-top">
                  <td className="px-4 py-3 text-slate-300">{item.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-100">{item.username}</td>
                  <td className="px-4 py-3 text-slate-200">{item.comment}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {new Date(item.commented_date).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
