import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import { characterProfiles } from "@/app/asset/entity/character/general/player/registry";
import {
  loadRateList,
  updateRateList,
} from "@/app/components/gachaHandler/rateListStore";
import type {
  SpecialRateEntry,
} from "@/app/components/gachaHandler/rateConfig";

const ensureAdminAccess = async () => {
  const cookieStore = await cookies();
  return hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value);
};

export async function GET() {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rateList = await loadRateList();
    const characterOptions = characterProfiles
      .map((profile) => ({ id: profile.id, label: profile.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json({ rateList, characterOptions });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load gacha manager config" },
      { status: 500 }
    );
  }
}

type PatchPayload = {
  specialRates?: SpecialRateEntry[];
};

export async function PATCH(request: Request) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PatchPayload;
  try {
    payload = (await request.json()) as PatchPayload;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (payload == null || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const rateList = await updateRateList({
      specialRates: Array.isArray(payload.specialRates)
        ? payload.specialRates
        : undefined,
    });
    return NextResponse.json({ rateList });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update gacha manager config" },
      { status: 500 }
    );
  }
}
