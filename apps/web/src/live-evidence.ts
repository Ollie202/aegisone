/**
 * Real, recorded 0G evidence from AegisOne's completed live runs (M5 and M7).
 *
 * Every value here is a genuine root / record id / transaction hash from a successful live run
 * that actually happened — not a placeholder, not a demo fixture, not a rehearsal. They are the
 * same values `hackathon/evidence.md`, `hackathon/m5-aristotle-mainnet.json` and
 * `hackathon/m7-live-evidence.json` record, and they are independently checkable on the public 0G
 * explorers via the URL helpers below.
 *
 * Extracted from `product.ts` (which renders `/proof`) so the VERIFIED page can present the same
 * anchors without either page duplicating a digest. One definition, two readers — a copied hash
 * that drifts is exactly how a page starts showing evidence that is not true any more.
 *
 * Two boundaries are recorded alongside the values and must always be presented with them:
 *   - TEE: the live TDX quote proves provider/runtime evidence only. The artifact digest is NOT
 *     cryptographically bound into the quote, so AegisOne does not claim TEE output binding.
 *   - Mainnet: M5 proves the Aristotle mainnet registry path. M7 derives Agent Skill commitments
 *     but is deliberately PREPARED_NOT_SUBMITTED — no second mainnet registration is claimed.
 */

export const SOFTWARE_DIGEST = "9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154";
export const SOFTWARE_TAMPER_DIGEST = "d5318963f53126b4c4bd448bffca222a8e08f068764e379516fc0ad3bd1f8889";

export const M5_STORAGE_ROOT = "0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181";
export const M5_STORAGE_TX = "0x3441077c159edec59e7af7e73a9fb74e8bca9d17a7b5f536d67712fdc7b4cdf6";
export const M5_MAINNET_REGISTRY = "0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4";
export const M5_MAINNET_RECORD = "0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e";
export const M5_MAINNET_TX = "0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac";

export const M7_SOURCE_COMMIT = "2f193aad92d2f807c2e25f67eb28c5090fa945cf";
export const M7_SKILL_DIGEST = "fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878";
export const M7_SKILL_TAMPER_DIGEST = "da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb";
export const M7_STORAGE_ROOT = "0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66";
export const M7_STORAGE_TX = "0x59a63ddf1d2d985b947e7829ec6a47c19760870ed066558123cf817d19fe063d";
export const M7_GALILEO_RECORD = "0x7d69de55eee666bb1d3f63ab2f7e3cc07c9097297f24b77281b958cf14d6ea7a";
export const M7_GALILEO_TX = "0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db";

export const GITHUB_URL = "https://github.com/Ollie202/aegisone";

/** Public 0G explorers. Mainnet (Aristotle) and testnet (Galileo) are different chains and are
 * deliberately never conflated in a link. */
export const mainnetTxUrl = (tx: string) => `https://chainscan.0g.ai/tx/${tx}`;
export const mainnetAddressUrl = (address: string) => `https://chainscan.0g.ai/address/${address}`;
export const galileoTxUrl = (tx: string) => `https://chainscan-galileo.0g.ai/tx/${tx}`;
