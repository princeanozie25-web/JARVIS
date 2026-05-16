"use client";

import { useState } from "react";
import type { Message } from "@/lib/types";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "JARVIS online. How can I help?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: input },
    ];

    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      if (!res.ok) {
        setError(`Request failed (${res.status}). Please try again.`);
        return;
      }

      if (!res.body) {
        setError("Empty response from server.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages([
        ...newMessages,
        { role: "assistant", content: "" },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages([
          ...newMessages,
          { role: "assistant", content: assistantContent },
        ]);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-6">
      <section className="w-full max-w-3xl flex-1">
        <h1 className="text-4xl font-bold tracking-widest mb-2">JARVIS</h1>
        <p className="text-gray-400 mb-8">Personal AI Operating Environment</p>

        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl ${
                message.role === "user"
                  ? "bg-blue-600 ml-12"
                  : "bg-gray-900 mr-12"
              }`}
            >
              <p className="text-sm text-gray-300 mb-1 uppercase">
                {message.role}
              </p>
              <p>{message.content}</p>
            </div>
          ))}

          {loading && (
            <div className="bg-gray-900 mr-12 p-4 rounded-xl">
              JARVIS is thinking...
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="border border-red-500 bg-red-950 text-red-200 mr-12 p-4 rounded-xl"
            >
              <p className="text-sm text-red-400 mb-1 uppercase">Error</p>
              <p>{error}</p>
            </div>
          )}
        </div>
      </section>

      <section className="w-full max-w-3xl flex gap-3 mt-6">
        <input
          className="flex-1 rounded-xl bg-gray-900 border border-gray-700 p-4 outline-none disabled:opacity-50"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message JARVIS..."
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />

        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-white text-black px-6 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </section>
    </main>
  );
}
