import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Masks an email address for display, keeping the first character of the
 * local part and the full domain (e.g. `jan@example.com` -> `j***@example.com`).
 * Returns an empty string for invalid/empty input.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!local || !domain) return ""
  return `${local[0]}***@${domain}`
}
