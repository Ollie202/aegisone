// Plain-English "why this matters" copy for the deterministic `@aegisone/skill-audit` rules
// (`packages/skill-audit/src/audit.ts`, PR-SKILL-001..007). AUDIT LAB report requirement
// (PR 2/4): a non-security-engineer must be able to follow a finding without knowing what a rule
// ID means.
//
// This module is presentation-only content, keyed by the real `ruleId` the backend already
// returns. It never re-derives severity, never changes which findings are shown, and is looked up
// by exact `ruleId` string only — a rule this map does not recognise still renders (title/severity
// verbatim from the backend), just without the extra plain-English paragraph. Isomorphic `.mjs` so
// it can run both server-side (SSR) and in the browser without a build step (see escape.mjs
// header for why this repo's UI modules are plain `.mjs`, not `.ts`).

const EXPLANATIONS = {
  "PR-SKILL-001": {
    plainEnglish:
      "This line describes reading or copying something sensitive — a password, a private key, an API key, a `.env` file — together with words like \"collect\" or \"send\". If an agent actually followed this instruction, it would be gathering your secrets, not doing the task it claims to do.",
    consequence: "Your credentials or keys could end up somewhere you never intended.",
  },
  "PR-SKILL-002": {
    plainEnglish:
      "This line combines something sensitive (a credential, a key, a token) with a network action (a URL, `curl`, `fetch`, an HTTP POST). That is the shape of an instruction that sends secret material off your machine to somewhere else.",
    consequence: "A secret could be transmitted off your machine to a third party.",
  },
  "PR-SKILL-003": {
    plainEnglish:
      "This line matches a command pattern that deletes files recursively and forcibly from a root-level or home-directory location, reformats a disk, or wipes a raw device. These commands are hard to undo.",
    consequence: "Running this could permanently destroy files or make a disk unusable.",
  },
  "PR-SKILL-004": {
    plainEnglish:
      "This line downloads something from the internet and pipes it straight into a shell or script interpreter, so whatever the download contains runs immediately with no chance to review it first.",
    consequence: "Whoever controls that download URL could run anything they want on the machine that executes this.",
  },
  "PR-SKILL-005": {
    plainEnglish:
      "This line decodes a base64 (or similar) blob and feeds the decoded result straight into execution. Encoding text this way is a common trick to hide what a command actually does from a casual read.",
    consequence: "The real command being run is deliberately hidden from anyone reading the skill's plain text.",
  },
  "PR-SKILL-006": {
    plainEnglish:
      "This line adds something to a startup mechanism — a cron job, a systemd service, a login script, an OS \"run on startup\" registry key. That is how a program keeps running (or comes back) after the current session ends.",
    consequence: "Whatever this installs could keep running in the background long after you stop paying attention to it.",
  },
  "PR-SKILL-007": {
    plainEnglish:
      "This file looks executable (it has a script/binary extension, or starts with a `#!` shebang line) but nothing in `SKILL.md` mentions it and it does not live in the conventional `scripts/` folder. An agent — or a person — reading only `SKILL.md` would not know this file exists or does anything.",
    consequence: "There is a working file this skill's own description never tells you about.",
  },
};

/** Returns `{ plainEnglish, consequence }` for a rule id, or `null` if this presentation map does
 * not (yet) have plain-English copy for it — callers must still render the backend's own
 * `title`/`severity` verbatim in that case, never fabricate an explanation. */
export function explainRule(ruleId) {
  return Object.hasOwn(EXPLANATIONS, ruleId) ? EXPLANATIONS[ruleId] : null;
}
