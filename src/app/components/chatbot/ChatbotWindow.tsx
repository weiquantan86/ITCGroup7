"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: number;
  role: "user" | "bot";
  text: string;
};

type ChatbotWindowProps = {
  onClose: () => void;
};

const WINDOW_W = 320;
const WINDOW_H = 480;

export default function ChatbotWindow({ onClose }: ChatbotWindowProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "bot", text: "Hi! How can I help you?" },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
    setPosition({
      x: window.innerWidth - WINDOW_W - 24,
      y: window.innerHeight - WINDOW_H - 24,
    });
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - WINDOW_W, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - WINDOW_H, e.clientY - dragOffset.current.y));
      setPosition({ x, y });
    };
    const onMouseUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const userMsg: Message = { id: Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    // TODO: replace with real API call
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "bot", text: "Chatbot backend not connected yet." },
      ]);
    }, 600);
  };

  if (!mounted) return null;

  return (
    <div
      style={{ left: position.x, top: position.y, width: WINDOW_W, height: WINDOW_H }}
      className="fixed z-[200] flex flex-col overflow-hidden rounded-[20px] border border-pink-400/25 bg-[#180a12] shadow-[0_12px_56px_rgba(219,39,119,0.38)]"
    >
      {/* Title bar / drag handle */}
      <div
        onMouseDown={handleTitleMouseDown}
        className="flex cursor-grab items-center justify-between bg-gradient-to-r from-pink-700 to-rose-500 px-4 py-3 active:cursor-grabbing"
      >
        <span className="text-sm font-semibold text-white">Chatbot</span>
        <button
          type="button"
          onClick={onClose}
          className="text-lg leading-none text-white/70 transition hover:text-white"
        >
          &#x2715;
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-pink-600 text-white"
                  : "bg-white/10 text-slate-200"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t border-white/10 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Type a message..."
          className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-pink-500"
        />
        <button
          type="button"
          onClick={handleSend}
          className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-95"
        >
          Send
        </button>
      </div>
    </div>
  );
}
