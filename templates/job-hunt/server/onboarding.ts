/**
 * job-hunt onboarding — registers the "Upload master resume" step.
 *
 * The master resume is the baseline for ATS comparison and resume tailoring,
 * and its Header section is where Tier-1 manual PII tokenization happens.
 */

import { registerOnboardingStep } from "@agent-native/core/onboarding";

registerOnboardingStep({
  id: "master-resume",
  order: 100,
  required: false,
  title: "Upload your master resume",
  description:
    "Paste your resume split into sections. Tokenize the Header (name/email/phone/links → ⟦NAME⟧ etc.) so PII never leaves your device.",
  methods: [
    {
      id: "manual-wizard",
      kind: "link",
      primary: true,
      label: "Open resume editor",
      description:
        "Paste your resume and pre-tokenize the Header section in the app.",
      payload: { url: "/master-resume" },
    },
    {
      id: "agent-task",
      kind: "agent-task",
      badge: "beta",
      label: "Have the agent guide me",
      payload: {
        prompt:
          "Help me set up my master resume. Explain how to split it into Header, PVP, Core Competencies, Skills, and Experience, and how to tokenize the Header (replace my real name, email, phone, address, and personal links with ⟦NAME⟧, ⟦EMAIL⟧, ⟦PHONE⟧, ⟦ADDRESS⟧, ⟦LINKS⟧). Keep employer names, job titles, and dates real. Then open the resume editor at /master-resume and wait for me to paste it.",
      },
    },
  ],
  isComplete: () => false,
  // Completion is per-user (a master_resume row exists), which the UI checks
  // via the get-master-resume action. The framework calls isComplete only for
  // workspace-scoped env-style steps, so we return false here and let the UI
  // drive the checklist state.
});
