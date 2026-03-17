import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import { syncFeedbackByIdToNotion } from "@/app/api/feedback/syncFromDatabase";

type RequestContext = {
  params: Promise<{ id: string }>;
};

const parseFeedbackId = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const ensureAdminAccess = async () => {
  const cookieStore = await cookies();
  return hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value);
};

export async function POST(_request: Request, context: RequestContext) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const feedbackId = parseFeedbackId(id);
  if (feedbackId == null) {
    return NextResponse.json({ error: "Invalid feedback id" }, { status: 400 });
  }

  try {
    const syncResult = await syncFeedbackByIdToNotion(feedbackId);
    if (syncResult.attempts === 0) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    if (!syncResult.synced) {
      return NextResponse.json(
        {
          error: "Failed to sync feedback to Notion.",
          reason: syncResult.reason,
          syncAttempts: syncResult.attempts,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      notionSynced: true,
      pageId: syncResult.pageId,
    });
  } catch (error) {
    console.error(
      "[api/admin/feedback/[id]/notion] Failed to sync feedback to Notion:",
      error
    );
    return NextResponse.json(
      { error: "Failed to sync feedback to Notion." },
      { status: 500 }
    );
  }
}
