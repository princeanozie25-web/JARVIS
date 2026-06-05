import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { JARVIS_THEME_DESCRIPTORS } from "@/lib/theme";

const PROVIDER_SOURCE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "components",
  "ThemeProvider.tsx",
);
const providerSource = readFileSync(PROVIDER_SOURCE_PATH, "utf8");

function ActiveTheme() {
  const { theme, descriptor } = useTheme();
  return (
    <span data-active-theme={theme} data-active-primary={descriptor.primary}>
      {descriptor.label}
    </span>
  );
}

describe("UI.7 ThemeProvider — file invariants", () => {
  it("is a client component", () => {
    expect(providerSource.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("imports the typed theme contract from @/lib/theme", () => {
    expect(providerSource).toContain('from "@/lib/theme"');
  });

  it("does not call any LED hardware adapter", () => {
    expect(providerSource).not.toMatch(/serial|hid|usb|bluetooth|gpio|i2c/i);
    expect(providerSource).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket/);
  });
});

describe("UI.7 ThemeProvider — initial render", () => {
  it("renders children with the default blue descriptor", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <ActiveTheme />
      </ThemeProvider>,
    );
    expect(html).toContain('data-active-theme="blue"');
    expect(html).toContain(JARVIS_THEME_DESCRIPTORS.blue.label);
    expect(html).toContain(JARVIS_THEME_DESCRIPTORS.blue.primary);
  });

  it("respects an explicit defaultTheme prop", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="purple">
        <ActiveTheme />
      </ThemeProvider>,
    );
    expect(html).toContain('data-active-theme="purple"');
    expect(html).toContain(JARVIS_THEME_DESCRIPTORS.purple.primary);
  });

  it("throws when useTheme is used outside the provider", () => {
    expect(() => renderToStaticMarkup(<ActiveTheme />)).toThrow(
      /useTheme must be used inside a <ThemeProvider>/,
    );
  });
});
