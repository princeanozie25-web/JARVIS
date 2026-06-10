"use client";

import type { CSSProperties, MutableRefObject, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import type {
  RestAmbientCard,
  RestCommandCenterModel,
  RestVoiceReactorState,
} from "@/lib/command-center/liquid-command-center-data";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "@/lib/observability/synthetic-data";
import { buildVoicePipelineVisibilityModel } from "@/lib/voice-operating-mode/pipeline-visibility";
import { buildSystemVoiceStackRuntimeState } from "@/lib/voice-operating-mode/voice-stack";

import type { CommandCenterRouteId } from "./CommandCenterNav";

const FALLBACK_CARDS: readonly RestAmbientCard[] = Object.freeze([
  {
    slot: "scout",
    source: "JOB SCOUT",
    body: "3 R&D roles matched overnight",
    meta: "suggestion only - nothing actioned",
  },
  {
    slot: "council",
    source: "COUNCIL - OVERNIGHT",
    body: "Consensus reached on the turbovec migration",
    meta: "ready when you want to review",
  },
  {
    slot: "coach",
    source: "LIFE COACH",
    body: "Two items from this week's CV goal",
    meta: "a gentle nudge, no pressure",
  },
  {
    slot: "flow",
    source: "WORKFLOW",
    body: "Resume: Command Center polish",
    meta: "paused 21h ago - tap to pick up",
  },
]);

const FALLBACK_MODEL: RestCommandCenterModel = {
  marker: SYNTHETIC_OBSERVABILITY_MARKER,
  cards: FALLBACK_CARDS,
  orb: {
    mode: "working",
    load_band: "active",
    last_event_class: "routine_completed",
    governance_posture: "all_green",
    heartbeat: "stable",
  },
  health: "OPTIMAL",
  security: "FORTRESS LOCK",
  voice: {
    micIndicatorRequired: true,
    explicitPermissionGate: true,
    authorizesActions: false,
    wakeMode: "openwakeword_local_onnx",
    reactorState: "sleep",
    reactorStates: [
      "sleep",
      "wake",
      "listening",
      "thinking",
      "speaking",
      "approval",
      "alert",
    ],
    stack: buildSystemVoiceStackRuntimeState(),
    pipelineEvents: buildVoicePipelineVisibilityModel().events,
  },
};

export interface RestCommandCenterProps {
  activeRoute?: CommandCenterRouteId;
  marker?: string;
  model?: RestCommandCenterModel;
}

export function RestCommandCenter({
  marker,
  model = FALLBACK_MODEL,
}: RestCommandCenterProps) {
  const clock = useClock();
  const rootRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const depthRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState("Awaiting you");
  const [reactorState, setReactorState] = useState<RestVoiceReactorState>(
    model.voice.reactorState,
  );
  const [surging, setSurging] = useState(false);
  const [ripples, setRipples] = useState<readonly number[]>([]);
  const [waveHeights, setWaveHeights] = useState([30, 65, 100, 55, 80, 35]);
  const visibleMarker = marker ?? model.marker;

  useEffect(() => {
    if (!listening) return;
    const interval = window.setInterval(() => {
      setWaveHeights((current) =>
        current.map(() => Math.round(25 + Math.random() * 75)),
      );
    }, 130);
    return () => window.clearInterval(interval);
  }, [listening]);

  useRestPointerLighting(rootRef, orbRef, wrapRef, depthRef, cardRefs);

  function wakeOrb() {
    const rippleId = Date.now();
    setRipples((current) => [...current, rippleId]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((id) => id !== rippleId));
    }, 1200);

    setSurging(false);
    window.requestAnimationFrame(() => {
      setSurging(true);
      window.setTimeout(() => setSurging(false), 900);
    });

    setReactorState((current) => {
      const next = nextReactorState(current, model.voice.reactorStates);
      setCaption(REACTOR_COPY[next]);
      setListening(next === "listening" || next === "speaking");
      return next;
    });
  }

  return (
    <section
      ref={rootRef}
      aria-label="JARVIS rest command center"
      className="jcc jcc-rest"
      data-command-center-shell="rest-liquid-glass"
      data-command-center-route="rest"
      data-rest-authority="none"
      data-rest-mutating-affordances="0"
      data-voice-authorizes-actions={String(model.voice.authorizesActions)}
      data-voice-reactor-state={reactorState}
      data-voice-wake-mode={model.voice.wakeMode}
      data-voice-stack-selected={model.voice.stack.selected_provider}
      data-observability-marker={visibleMarker}
    >
      <CommandCenterField depthRef={depthRef} includeFourthBlob />

      <main className="jcc-stage">
        <header className="jcc-rest-header">
          <div className="jcc-wordmark">
            JARVIS<span>rest mode</span>
          </div>
          <div className="jcc-clock">
            <div className="jcc-clock-time">{clock}</div>
            <div className="jcc-clock-state">
              <span className="jcc-pulse-dot" />
              SYSTEM STANDBY
            </div>
          </div>
        </header>

        <div ref={wrapRef} className="jcc-orb-wrap">
          <div
            ref={orbRef}
            className={`jcc-orb ${listening ? "listening" : ""} ${
              surging ? "surge-on" : ""
            }`}
            data-rest-voice-wake="openwakeword-local-onnx"
            data-wake-phrase="Hey Jarvis you up"
            data-pre-wake-audio-storage="false"
            data-voice-permission-gate="required"
            data-mic-indicator="visible"
            tabIndex={0}
            aria-pressed={listening}
            aria-label="Wake JARVIS voice orb"
            onClick={wakeOrb}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                wakeOrb();
              }
            }}
          >
            <div className="jcc-ring" />
            <div className="jcc-ring two" />
            <div className="jcc-sphere">
              <div className="jcc-caustic jcc-c1" />
              <div className="jcc-caustic jcc-c2" />
              <div className="jcc-sweep" />
            </div>
            <div className="jcc-surge" />
            <div className="jcc-core" />
            <div className="jcc-mic" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#eef6ff"
                strokeWidth="1.4"
                strokeLinecap="round"
              >
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </div>
            <div className="jcc-wave" aria-hidden="true">
              {waveHeights.map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            {ripples.map((id) => (
              <span key={id} className="jcc-ripple" style={rippleStyle} />
            ))}
          </div>
          <div className="jcc-orb-caption">
            <div className="lead">{caption}</div>
            <div className="hint">HEY JARVIS YOU UP</div>
            <div
              className="jcc-reactor-states"
              aria-label="Voice reactor states"
            >
              {model.voice.reactorStates.map((state) => (
                <span
                  key={state}
                  data-reactor-state={state}
                  data-reactor-state-active={String(state === reactorState)}
                >
                  {state}
                </span>
              ))}
            </div>
          </div>
        </div>

        {model.cards.map((card, index) => (
          <article
            key={card.slot}
            ref={(node) => {
              cardRefs.current[index] = node;
            }}
            className={`jcc-card ${card.slot}`}
            data-suggestion-card={card.slot}
            data-suggestion-executable="false"
            data-authority="none"
          >
            <div className="src">
              <span className="dot" />
              {card.source}
            </div>
            <div className="body">{card.body}</div>
            <div className="meta">{card.meta}</div>
          </article>
        ))}

        <footer className="jcc-rest-footer">
          <div>SYNTHETIC - METADATA-ONLY - NO ACTION AUTHORITY</div>
          <div className="right">
            <span>
              HEALTH <b>{model.health}</b>
            </span>
            <span>
              SECURITY <b>{model.security}</b>
            </span>
            <span>
              VOICE{" "}
              <b>{voiceStackLabel(model.voice.stack.selected_provider)}</b>
            </span>
          </div>
        </footer>
      </main>
    </section>
  );
}

const REACTOR_COPY: Record<RestVoiceReactorState, string> = {
  sleep: "Awaiting you",
  wake: "Ignition",
  listening: "Listening...",
  thinking: "Thinking",
  speaking: "Speaking",
  approval: "Human Gate",
  alert: "Attention",
};

function nextReactorState(
  current: RestVoiceReactorState,
  states: readonly RestVoiceReactorState[],
): RestVoiceReactorState {
  const index = states.indexOf(current);
  return states[(index + 1) % states.length] ?? "sleep";
}

function voiceStackLabel(value: string): string {
  if (value === "chatterbox-tts-server") return "CHATTERBOX";
  if (value === "kokoro") return "KOKORO";
  return "LOCAL";
}

function CommandCenterField({
  depthRef,
  includeFourthBlob = false,
}: Readonly<{
  depthRef?: RefObject<HTMLDivElement | null>;
  includeFourthBlob?: boolean;
}>) {
  return (
    <>
      <div className="jcc-field" />
      <div ref={depthRef} className="jcc-depth">
        <div className="jcc-blob jcc-b1" />
        <div className="jcc-blob jcc-b2" />
        <div className="jcc-blob jcc-b3" />
        {includeFourthBlob ? <div className="jcc-blob jcc-b4" /> : null}
      </div>
      <div className="jcc-grain" />
    </>
  );
}

function useClock() {
  const [clock, setClock] = useState("00:00");

  useEffect(() => {
    function update() {
      const date = new Date();
      setClock(
        `${String(date.getHours()).padStart(2, "0")}:${String(
          date.getMinutes(),
        ).padStart(2, "0")}`,
      );
    }
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return clock;
}

function useRestPointerLighting(
  rootRef: RefObject<HTMLDivElement | null>,
  orbRef: RefObject<HTMLDivElement | null>,
  wrapRef: RefObject<HTMLDivElement | null>,
  depthRef: RefObject<HTMLDivElement | null>,
  cardRefs: MutableRefObject<Array<HTMLElement | null>>,
) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pointerLightX = 32;
    let pointerLightY = 26;
    let targetLightX = 32;
    let targetLightY = 26;
    let parallaxX = 0;
    let parallaxY = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let frameId = 0;

    function onMouseMove(event: MouseEvent) {
      const orb = orbRef.current;
      if (!orb) return;
      const rect = orb.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      targetLightX =
        50 +
        Math.max(-1, Math.min(1, (event.clientX - centerX) / rect.width)) * 36;
      targetLightY =
        50 +
        Math.max(-1, Math.min(1, (event.clientY - centerY) / rect.height)) * 36;
      targetParallaxX = event.clientX / window.innerWidth - 0.5;
      targetParallaxY = event.clientY / window.innerHeight - 0.5;
    }

    function frame() {
      pointerLightX += (targetLightX - pointerLightX) * 0.08;
      pointerLightY += (targetLightY - pointerLightY) * 0.08;
      rootRef.current?.style.setProperty(
        "--gx",
        `${pointerLightX.toFixed(1)}%`,
      );
      rootRef.current?.style.setProperty(
        "--gy",
        `${pointerLightY.toFixed(1)}%`,
      );

      parallaxX += (targetParallaxX - parallaxX) * 0.06;
      parallaxY += (targetParallaxY - parallaxY) * 0.06;
      if (depthRef.current) {
        depthRef.current.style.transform = `translate(${parallaxX * 7}px, ${
          parallaxY * 7
        }px)`;
      }
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate(calc(-50% + ${
          parallaxX * 17
        }px), calc(-50% + ${parallaxY * 17}px))`;
      }
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const multiplier = (index % 2 ? -1 : 1) * 10;
        card.style.translate = `${parallaxX * multiplier}px ${
          parallaxY * multiplier
        }px`;
      });

      frameId = window.requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", onMouseMove);
    frameId = window.requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.cancelAnimationFrame(frameId);
    };
  }, [cardRefs, depthRef, orbRef, rootRef, wrapRef]);
}

const rippleStyle: CSSProperties = {
  inset: 0,
  width: "100%",
  height: "100%",
};
