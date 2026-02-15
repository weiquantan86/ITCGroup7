import { NextResponse } from "next/server";
import { adminAccessCookieName } from "@/app/admin/adminAuth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/userSystem/login", request.url)
  );
  response.cookies.set({
    name: "user_id",
    value: "",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: "selected_character_id",
    value: "",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: adminAccessCookieName,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
