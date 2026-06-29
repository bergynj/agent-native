import { defineEventHandler } from "h3";
import { runAuthGuard } from "@agent-native/core/server";

/**
 * Global auth middleware — runs for ALL requests (page routes, API routes,
 * framework routes). Without this, auth only runs for /_agent-native/* routes.
 */
export default defineEventHandler(async (event) => {
  return runAuthGuard(event);
});
