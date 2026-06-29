import { createCoreRoutesPlugin } from "@agent-native/core/server";

export default createCoreRoutesPlugin({
  envKeys: [
    {
      key: "A2A_SECRET",
      label: "A2A secret",
      required: false,
      helpText:
        "Optional. Used to sign cross-app call-agent requests (e.g. to Mail).",
    },
  ],
});
