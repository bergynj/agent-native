import { defineAction } from "@agent-native/core/action";
import { getRequestUserEmail } from "@agent-native/core/server";
import { z } from "zod";
import {
  TOKEN_OPEN,
  TOKEN_CLOSE,
  loadTokenMap,
  saveToken,
  removeToken,
} from "../server/lib/pii.js";

function normalizeToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.startsWith(TOKEN_OPEN) && trimmed.endsWith(TOKEN_CLOSE)) {
    return trimmed;
  }
  return `${TOKEN_OPEN}${trimmed}${TOKEN_CLOSE}`;
}

export default defineAction({
  description:
    "Manage the local PII token map (the deterministic per-user mapping of ⟦TOKEN⟧ -> real value that powers PII scrub/re-inject). Values never leave the device except through this map's local storage. Actions: list, add, remove, clear.",
  schema: z.object({
    action: z
      .enum(["list", "add", "remove", "clear"])
      .describe("Operation to perform on the token map"),
    token: z
      .string()
      .optional()
      .describe("Token (with or without ⟦⟧ brackets) for add/remove"),
    realValue: z
      .string()
      .optional()
      .describe("Real value to map the token to (add only)"),
  }),
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  run: async (args) => {
    const ownerEmail = getRequestUserEmail();
    if (!ownerEmail) throw new Error("no authenticated user");

    if (args.action === "list") {
      const map = await loadTokenMap(ownerEmail);
      return {
        tokens: [...map.entries()].map(([token, realValue]) => ({
          token,
          realValue,
        })),
      };
    }

    if (args.action === "add") {
      if (!args.token || !args.realValue) {
        return "Error: --token and --real-value are required for add.";
      }
      const token = normalizeToken(args.token);
      await saveToken(ownerEmail, token, args.realValue);
      return `Saved ${token} -> (redacted)`;
    }

    if (args.action === "remove") {
      if (!args.token) return "Error: --token is required for remove.";
      const token = normalizeToken(args.token);
      await removeToken(ownerEmail, token);
      return `Removed ${token}`;
    }

    // clear
    const map = await loadTokenMap(ownerEmail);
    for (const token of map.keys()) await removeToken(ownerEmail, token);
    return `Cleared ${map.size} token(s)`;
  },
});
