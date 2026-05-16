"use client";

import { useState } from "react";
import type { Message } from "@/src/lib/types";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "JARVIS online. How can I help?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: input },
    ];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: newMessages,
      }),
    });

    const data = await res.json();

    setMessages([
      ...newMessages,
      {
        role: "assistant",
        content: data.message,
      },
    ]);

    setLoading(false);
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
        </div>
      </section>

      <section className="w-full max-w-3xl flex gap-3 mt-6">
        <input
          className="flex-1 rounded-xl bg-gray-900 border border-gray-700 p-4 outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message JARVIS..."
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />

        <button
          onClick={sendMessage}
          className="rounded-xl bg-white text-black px-6 font-semibold"
        >
          Send
        </button>
      </section>
    </main>
  );
}