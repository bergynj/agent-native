/**
 * SSR entry point for Nitro.
 *
 * Wraps React Router's request handler so Nitro can use it as an SSR service.
 * The file must be a real file (not a virtual module) so Nitro can resolve it
 * during build.
 */
import { createRequestHandler } from "react-router";

const handler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
);

export default {
  async fetch(request: Request) {
    return handler(request);
  },
};
