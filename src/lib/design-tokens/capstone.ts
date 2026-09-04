// Program U (E-030) — TS mirror of the capstone (--jarvis-cc-*) palette in
// tokens.css, kept in lockstep by tests/capstone/core.test.tsx. WebGL
// materials cannot read CSS variables, so the Core's renderer takes its
// colours from here (and re-reads the live CSS variables on mount when a
// document exists). This is the ONLY place a capstone colour literal lives
// outside tokens.css.
export const capstonePalette = Object.freeze({
  field: "#000000",
  surface: "#04091a",
  hairline: "#101c3a",
  ink: "#e8eef9",
  inkMuted: "#7f93b8",
  accent: "#2f7bff",
  core: "#9fdcff",
  gate: "#f5a524",
  ok: "#34d399",
  fail: "#f87171",
});

export type CapstonePalette = Readonly<
  Record<keyof typeof capstonePalette, string>
>;

export const CAPSTONE_TOKEN_NAMES: Readonly<
  Record<keyof CapstonePalette, string>
> = Object.freeze({
  field: "--jarvis-cc-field",
  surface: "--jarvis-cc-surface",
  hairline: "--jarvis-cc-hairline",
  ink: "--jarvis-cc-ink",
  inkMuted: "--jarvis-cc-ink-muted",
  accent: "--jarvis-cc-accent",
  core: "--jarvis-cc-core",
  gate: "--jarvis-cc-gate",
  ok: "--jarvis-cc-ok",
  fail: "--jarvis-cc-fail",
});
