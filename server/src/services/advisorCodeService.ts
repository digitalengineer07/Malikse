import crypto from "node:crypto";
import { User } from "../models/User.model";

const ADVISOR_CODE_REGEX = /^ADV-[1-9][0-9]{5}$/;

/**
 * Normalizes user input into canonical ADV-XXXXXX format.
 * Accepts: "ADV-482910", "adv-482910", "ADV482910", "482910"
 */
export function normalizeAdvisorCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const clean = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!clean) return null;

  if (ADVISOR_CODE_REGEX.test(clean)) {
    return clean;
  }

  // If user entered only digits: e.g. "482910"
  if (/^[1-9][0-9]{5}$/.test(clean)) {
    return `ADV-${clean}`;
  }

  // If user entered without hyphen: e.g. "ADV482910"
  if (/^ADV[1-9][0-9]{5}$/.test(clean)) {
    return `ADV-${clean.slice(3)}`;
  }

  return null;
}

/**
 * Checks whether the given string is in valid ADV-XXXXXX format.
 */
export function isValidAdvisorCode(code: string): boolean {
  return ADVISOR_CODE_REGEX.test(code);
}

/**
 * Generates a collision-free ADV-XXXXXX unique code with atomic uniqueness checking.
 */
export async function generateUniqueAdvisorCode(): Promise<string> {
  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const digits = crypto.randomInt(100000, 1000000);
    const code = `ADV-${digits}`;
    const exists = await User.exists({ advisorCode: code });
    if (!exists) {
      return code;
    }
  }
  throw new Error("Unable to allocate unique advisor code. Please try again.");
}
