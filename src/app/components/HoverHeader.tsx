"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ChatbotWindow from "./chatbot/ChatbotWindow";

export default function HoverHeader() {
  const pathname = usePathname();
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const isUserHome = normalizedPath.endsWith("/userSystem/user");
  const isUserSystemPage = normalizedPath.includes("/userSystem");
  const hideHeader = normalizedPath === "/" || (isUserSystemPage && !isUserHome);
  const [chatOpen, setChatOpen] = useState(false);

  if (hideHeader) {
    return null;
  }

  return (
    <>
      {/* Hover-reveal header */}
      <div className="group fixed left-0 right-0 top-0 z-50 -translate-y-[calc(100%-8px)] transition-transform duration-300 ease-in-out hover:translate-y-0">
        <header className="flex items-center gap-3 bg-gradient-to-r from-pink-700 via-pink-600 to-rose-500 px-8 py-4 shadow-[0_6px_28px_rgba(219,39,119,0.4)]">
          {!isUserHome && (
            <Link
              href="/userSystem/user"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/25 active:scale-95"
            >
              &#8592; Home
            </Link>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/25 active:scale-95"
          >
            Chatbot
          </button>
        </header>
        {/* Pull-down indicator strip */}
        <div className="h-2 w-full bg-transparent transition-colors duration-300 group-hover:bg-pink-800/0" />
      </div>

      {/* Draggable chatbot window */}
      {chatOpen && <ChatbotWindow onClose={() => setChatOpen(false)} />}
    </>
  );
}
