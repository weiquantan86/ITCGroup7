"use client";

import { useEffect, useRef, useState } from "react";
import { characterProfiles } from "../../asset/entity/character/general/player/registry";

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

const GAME_MODES = [
  {
    name: "Mochi General Battle",
    description: "A high-intensity boss battle where you face off against the Mochi General. Master your dodging and timing to defeat this powerful foe!",
    keywords: ["general", "battle", "boss"],
  },
  {
    name: "Mochi Soldier Surge",
    description: "A survival mode where you must hold out against waves of Mochi Soldiers. How many can you defeat before they overwhelm you?",
    keywords: ["soldier", "surge", "wave", "survival"],
  },
  {
    name: "Mada Combat",
    description: "Test your skills in a specialized combat arena against Mada. A great place to practice your character's combos and abilities.",
    keywords: ["mada", "combat", "arena", "practice"],
  },
];

export default function ChatbotWindow({ onClose }: ChatbotWindowProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "bot", text: "Hi! I'm your game assistant. Ask me about game modes or character skills!" },
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

  const getBotResponse = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase();

    // Check for character skills
    const character = characterProfiles.find(p => 
      lowerInput.includes(p.label.toLowerCase()) || lowerInput.includes(p.id.toLowerCase())
    );

    if (character) {
      const skills = character.kit?.skills;
      const basic = character.kit?.basicAttack;
      let response = `**${character.label}'s Skills:**\n\n`;
      if (basic) response += `• **Basic Attack**: ${basic.description}\n`;
      if (skills) {
        response += `• **Q (${skills.q.label})**: ${skills.q.description}\n`;
        response += `• **E (${skills.e.label})**: ${skills.e.description}\n`;
        response += `• **R (${skills.r.label})**: ${skills.r.description}`;
      }
      return response;
    }

    // Check for game modes
    const mode = GAME_MODES.find(m => 
      lowerInput.includes(m.name.toLowerCase()) || m.keywords.some(k => lowerInput.includes(k))
    );

    if (mode) {
      return `**${mode.name}**\n\n${mode.description}`;
    }

    // Default responses
    if (lowerInput.includes("game mode") || lowerInput.includes("modes")) {
      const modesList = GAME_MODES.map(m => `• **${m.name}**`).join("\n");
      return `We have the following game modes:\n${modesList}\n\nWhich one would you like to know more about?`;
    }

    if (lowerInput.includes("character") || lowerInput.includes("skill") || lowerInput.includes("list")) {
      const names = characterProfiles.map(p => `• **${p.label}**`).join("\n");
      return `I can tell you about the skills of these characters:\n${names}\n\nJust type a name to see their kit!`;
    }

    return "I'm not sure I understand. You can ask me about game modes (like 'Soldier Surge') or character skills (like 'Flare skills').";
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const userMsg: Message = { id: Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const botResponse = getBotResponse(text);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "bot", text: botResponse },
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
              className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-pink-600 text-white"
                  : "bg-white/10 text-slate-200"
              }`}
            >
              {msg.text.split("\n").map((line, i) => {
                // Simple bold parsing: splits by **word** and renders <strong> for matches
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                  <p key={i}>
                    {parts.map((part, j) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                      }
                      return part;
                    })}
                  </p>
                );
              })}
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
