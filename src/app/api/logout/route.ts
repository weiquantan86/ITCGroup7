import { NextResponse } from "next/server";
import { adminAccessCookieName } from "@/app/admin/adminAuth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/userSystem/login", request.url),
    { status: 303 }
  );
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: "user_id",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: "selected_character_id",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: adminAccessCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  return response;
}
