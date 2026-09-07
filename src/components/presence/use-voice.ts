"use client";
// Voice for the presence: hold to talk (mic → 16 kHz WAV → parakeet), and
// Lewis speaking replies (text → kokoro WAV → <audio>). Starting to talk
// while JARVIS is speaking cuts him off: the interruption is the point.
import { useCallback, useEffect, useRef, useState } from "react";

import { clipToWav16k } from "./wav";

export interface UseVoice {
  supported: boolean;
  recording: boolean;
  speaking: boolean;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  speak: (text: string) => Promise<void>;
  hush: () => void;
  lastError: string | null;
}

export function useVoice(): UseVoice {
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabledState] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  useEffect(() => {
    // Read the remembered preference after mount (never during hydration).
    const t = setTimeout(() => {
      try {
        if (window.localStorage.getItem("jarvis.presence.voice") === "off") {
          setEnabledState(false);
        }
      } catch {
        /* per-viewer convenience only */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      window.localStorage.setItem("jarvis.presence.voice", v ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, []);

  const hush = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = "";
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const start = useCallback(async () => {
    if (!supported || recording) return;
    hush();
    setLastError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start(250);
      recorderRef.current = rec;
      setRecording(true);
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "microphone unavailable",
      );
    }
  }, [hush, recording, supported]);

  const stop = useCallback(async (): Promise<string | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;
    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () =>
        resolve(
          new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }),
        );
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    if (blob.size < 2000) return null;
    try {
      const wav = await clipToWav16k(blob);
      const res = await fetch("/api/presence/transcribe", {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: wav,
      });
      if (!res.ok) {
        setLastError(`could not hear that (${res.status})`);
        return null;
      }
      const data = (await res.json()) as { transcript?: string };
      const text = (data.transcript ?? "").trim();
      return text || null;
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "could not hear that",
      );
      return null;
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!enabled || !text.trim()) return;
      hush();
      try {
        const res = await fetch("/api/presence/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const url = URL.createObjectURL(await res.blob());
        const a = new Audio(url);
        audioRef.current = a;
        setSpeaking(true);
        a.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
          if (audioRef.current === a) audioRef.current = null;
        };
        a.onerror = () => setSpeaking(false);
        await a.play().catch(() => setSpeaking(false));
      } catch {
        setSpeaking(false);
      }
    },
    [enabled, hush],
  );

  return {
    supported,
    recording,
    speaking,
    enabled,
    setEnabled,
    start,
    stop,
    speak,
    hush,
    lastError,
  };
}
