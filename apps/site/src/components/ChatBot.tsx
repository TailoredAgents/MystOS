'use client';

import * as React from "react";
import { Button, cn } from "@myst-os/ui";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
}

const SUGGESTIONS = [
  "What services do you offer?",
  "How long does a visit take?",
  "What solutions do you use?",
  "Can you give me a price range for a driveway?",
  "Do you carry insurance?"
];

function fallbackResponse(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("driveway")) return "Driveway cleans typically range from $120–$260 depending on size, stains, and access.";
  if (m.includes("roof")) return "Roof treatments often range $350–$650 for most single family homes with soft-wash.";
  if (m.includes("house") || m.includes("home")) return "Whole-home soft-wash projects usually fall between $220–$480 based on square footage and elevations.";
  if (m.includes("window")) return "Exterior window rinsing can be added for about $6–$8 per opening.";
  if (m.includes("deck") || m.includes("patio")) return "Deck and patio refreshes start near $180 and scale with square footage and railing detail.";
  if (m.includes("insurance")) return "Yes—Myst is licensed and carries general liability and workers comp. COIs available on request.";
  return "Thanks for the question! Book an on-site estimate so we can confirm details and give exact pricing.";
}

export function ChatBot() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    { id: "initial", sender: "bot", text: "Hi! I'm Myst Assist. Ask about services, pricing ranges, or how we work." }
  ]);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    return () => clearTimeout(t);
  }, [messages, isOpen]);

  async function callAssistant(message: string): Promise<string | null> {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      if (!res.ok) return null;
      const data = (await res.json()) as unknown as { ok?: boolean; reply?: string };
      return typeof data?.reply === "string" ? data.reply : null;
    } catch {
      return null;
    }
  }

  const handleSend = async (message: string) => {
    const text = message.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: "user", text }]);
    setInput("");

    const ai = await callAssistant(text);
    const reply = ai ?? fallbackResponse(text);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: "bot", text: reply }]);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSend(input);
  };

  return (
    <div className="fixed right-6 bottom-24 md:bottom-6 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <div className="w-full max-w-xs rounded-xl border border-neutral-300/70 bg-white shadow-xl shadow-primary-900/10 sm:max-w-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="font-semibold text-primary-800">Myst Assist</p>
              <p className="text-xs text-neutral-500">Ask anything about our services</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-lg px-3 py-2",
                  m.sender === "bot" ? "bg-neutral-100 text-neutral-700" : "ml-auto bg-accent-600 text-white"
                )}
              >
                {m.text}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t border-neutral-200 px-4 py-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-neutral-300 px-2 py-1 text-xs text-neutral-600 transition hover:border-accent-400 hover:text-accent-600"
                  onClick={() => void handleSend(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question"
                className="flex-1 rounded-md border border-neutral-300/70 bg-white px-3 py-2 text-sm text-neutral-700 shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              />
              <Button type="submit" variant="primary" size="sm">
                Send
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        variant={isOpen ? "secondary" : "primary"}
        onClick={() => setIsOpen((prev) => !prev)}
        className="shadow-lg shadow-primary-900/20"
      >
        {isOpen ? "Hide Assistant" : "Ask Myst"}
      </Button>
    </div>
  );
}


