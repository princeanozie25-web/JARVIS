import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// U.2 (E-029): the shadcn `cn` helper. Class composition only — no tokens,
// no colors, no behavior live here.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
