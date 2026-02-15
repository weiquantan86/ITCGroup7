import { NextResponse } from "next/server";
import {
  adminAccessCookieName,
  adminAccessCookieValue,
  password,
} from "@/app/admin/adminAuth";

type AuthPayload = {
  password?: unknown;
};

export async function POST(request: Request) {
  let payload: AuthPayload;
  try {
    payload = await request.json();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (typeof payload.password !== "string") {
    return NextResponse.json({ error: "Invalid password" }, { status: 400 });
  }

  if (payload.password !== password) {
    return NextResponse.json(
      { success: false, error: "Invalid admin password." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: adminAccessCookieName,
    value: adminAccessCookieValue,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
