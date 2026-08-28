// Bespoke per-category skill illustrations (ADR-016).
//
// ==========================================================================================
// THREE DISTINCT VISUAL SYSTEMS — do not merge them.
// ==========================================================================================
// AegisOne deliberately keeps three different kinds of mark apart, because collapsing them is
// exactly how a decorative graphic starts reading as a verdict:
//
//   1. BRAND MARK      the repo owner's real logo file, /static/brand/logo.jpg. Identity only.
//   2. VERDICT STAMP   `#ic-stamp` / `#ic-bytegrid` in layout.ts. Pressed only where AegisOne
//                      actually holds correspondence evidence. Never used for decoration.
//   3. CATEGORY ART    this file. One illustration per *category*, assigned by the deterministic
//                      classifier in `skill-category.mjs`. Topic/browse decoration only.
//
// A previous pass reused the verdict stamp as the illustration for every skill; that was wrong on
// both counts (it made every row look identically "sealed", and it made the stamp meaningless).
// Nothing in this file may contain a checkmark, a tick, a seal-with-approval, a shield-with-tick,
// or any other glyph that could be read as "this skill passed something" — a category names a
// topic, never a verdict. `apps/web/test/skill-category.test.ts` asserts that.
//
// Style follows the repo owner's design skill (§5 Illustration Language, §6 Linework): flat vector
// shapes, heavy 2-4px dark outlines, simplified geometry, minimal shading, recognisable cartoon
// physical objects combined with abstract geometry. No gradients, no glass, no 3D, no stock art,
// no external asset request -- every illustration is inline SVG served from this origin.
//
// All art is `aria-hidden`: the category is ALWAYS also rendered as a text label beside it, so the
// illustration is reinforcement and never the only signal (AGENTS.md: colour/graphics are never
// the sole carrier of any state).

const INK = "#0a0a0a";
const YELLOW = "#ffd91a";
const LAVENDER = "#b79cff";
const CYAN = "#22dceb";
const PERIWINKLE = "#d8e1ff";
const CARD = "#fffdf7";

/** Shared stroke attributes so every illustration has the same printed/comic-like linework. */
const S = `fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"`;
const SF = (fill) => `fill="${fill}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`;

/**
 * Frontend / Design — a tilted browser window with a flat colour block, a pen nib breaking the
 * lower-right boundary, and a loose swatch dot escaping the top-left (design skill §9: deliberate
 * overflow, -6deg..6deg rotation).
 */
const frontendDesign = `
  <g transform="rotate(-5 60 60)">
    <rect x="16" y="26" width="86" height="64" rx="11" ${SF(PERIWINKLE)}/>
    <path d="M16 45 H102" ${S}/>
    <circle cx="28" cy="35.5" r="3.6" fill="${INK}"/>
    <circle cx="40" cy="35.5" r="3.6" fill="${INK}"/>
    <rect x="26" y="55" width="36" height="8" rx="4" fill="${INK}"/>
    <rect x="26" y="69" width="23" height="8" rx="4" fill="${INK}"/>
    <rect x="71" y="55" width="22" height="22" rx="6" ${SF(YELLOW)}/>
  </g>
  <g transform="rotate(14 97 95)">
    <path d="M88 74 H106 V95 L97 107 L88 95 Z" ${SF(LAVENDER)}/>
    <path d="M97 95 V84" ${S}/>
  </g>
  <circle cx="13" cy="19" r="7.5" ${SF(CYAN)}/>
`;

/**
 * DeFi — a stack of outlined coins beside a rail/pipe carrying a token along it. Pipes, coins and
 * connectors are the design skill's own suggested metaphor for a payments/value product (§19).
 */
const defi = `
  <g transform="rotate(-4 44 74)">
    <path d="M17 58 V79 A27 11 0 0 0 71 79 V58" ${SF(YELLOW)}/>
    <ellipse cx="44" cy="58" rx="27" ry="11" ${SF(YELLOW)}/>
    <path d="M17 69 A27 11 0 0 0 71 69" ${S}/>
    <ellipse cx="44" cy="42" rx="27" ry="11" ${SF(CARD)}/>
    <path d="M38 42 H50" ${S}/>
  </g>
  <path d="M84 26 V70 A14 14 0 0 1 70 84 H58" ${S}/>
  <circle cx="84" cy="26" r="9" ${SF(CYAN)}/>
  <path d="M64 78 L56 84 L64 90" ${S}/>
  <rect x="92" y="88" width="18" height="18" rx="5" ${SF(LAVENDER)} transform="rotate(12 101 97)"/>
`;

/**
 * Smart Contracts — a folded document with body copy and two interlocking chain links. Deliberately
 * NOT a wax seal with a tick: a seal reads as approval, and a category must never imply one.
 */
const smartContracts = `
  <g transform="rotate(-3 58 58)">
    <path d="M24 16 H74 L92 34 V100 H24 Z" ${SF(CARD)}/>
    <path d="M74 16 V34 H92" ${S}/>
    <path d="M38 48 H78 M38 61 H78 M38 74 H62" ${S}/>
  </g>
  <g transform="rotate(18 84 90)">
    <rect x="62" y="80" width="30" height="20" rx="10" ${SF(YELLOW)}/>
    <rect x="82" y="80" width="30" height="20" rx="10" ${SF(CYAN)}/>
  </g>
`;

/** Research — a fanned stack of papers under a magnifier lens. */
const research = `
  <g>
    <rect x="20" y="30" width="54" height="66" rx="7" ${SF(CARD)} transform="rotate(-9 47 63)"/>
    <rect x="26" y="26" width="54" height="66" rx="7" ${SF(PERIWINKLE)} transform="rotate(4 53 59)"/>
    <path d="M40 48 H72 M39 61 H72 M40 74 H60" ${S}/>
  </g>
  <g transform="rotate(-8 82 78)">
    <circle cx="82" cy="70" r="22" ${SF(YELLOW)} fill-opacity="0.55"/>
    <circle cx="82" cy="70" r="22" ${S}/>
    <path d="M97 86 L110 100" stroke="${INK}" stroke-width="7" stroke-linecap="round" fill="none"/>
  </g>
`;

/** Automation — a driving gear feeding a looped conveyor arrow that carries a work item. */
const automation = `
  <g transform="rotate(6 42 50)">
    <path d="M42 22 L50 26 L58 22 L61 31 L70 34 L66 42 L70 50 L61 53 L58 62 L50 58 L42 62 L39 53 L30 50 L34 42 L30 34 L39 31 Z" ${SF(YELLOW)}/>
    <circle cx="50" cy="42" r="10" ${SF(CARD)}/>
  </g>
  <path d="M26 78 H84 A12 12 0 0 1 84 102 H40" ${S}/>
  <path d="M50 94 L40 102 L50 110" ${S}/>
  <rect x="20" y="68" width="20" height="20" rx="5" ${SF(LAVENDER)} transform="rotate(-12 30 78)"/>
  <circle cx="94" cy="24" r="8" ${SF(CYAN)}/>
`;

/** Developer Tools — a terminal window with a prompt chevron, crossed by an outlined wrench. */
const developerTools = `
  <g transform="rotate(-4 58 58)">
    <rect x="14" y="24" width="88" height="66" rx="11" ${SF(INK)}/>
    <path d="M14 42 H102" stroke="${CARD}" stroke-width="3.5" fill="none"/>
    <circle cx="26" cy="33" r="3.6" fill="${YELLOW}"/>
    <circle cx="38" cy="33" r="3.6" fill="${CYAN}"/>
    <path d="M28 56 L38 65 L28 74" fill="none" stroke="${CARD}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M48 76 H84" fill="none" stroke="${CARD}" stroke-width="4.5" stroke-linecap="round"/>
  </g>
  <g transform="rotate(38 92 92)">
    <path d="M86 66 A11 11 0 1 0 98 78 V108 H86 Z" ${SF(LAVENDER)}/>
  </g>
`;

/** Data — stacked storage cylinders beside a small outlined bar series. */
const data = `
  <g transform="rotate(-3 46 62)">
    <path d="M18 34 V86 A26 10 0 0 0 70 86 V34" ${SF(PERIWINKLE)}/>
    <path d="M18 52 A26 10 0 0 0 70 52" ${S}/>
    <path d="M18 69 A26 10 0 0 0 70 69" ${S}/>
    <ellipse cx="44" cy="34" rx="26" ry="10" ${SF(CARD)}/>
  </g>
  <g transform="rotate(5 94 76)">
    <rect x="80" y="72" width="13" height="30" rx="4" ${SF(YELLOW)}/>
    <rect x="96" y="56" width="13" height="46" rx="4" ${SF(CYAN)}/>
  </g>
  <circle cx="96" cy="26" r="7.5" ${SF(LAVENDER)}/>
`;

/** Agents / MCP — two outlined agent heads exchanging work over a plugged connector. */
const agentsMcp = `
  <g transform="rotate(-6 34 56)">
    <rect x="12" y="38" width="46" height="40" rx="12" ${SF(CYAN)}/>
    <circle cx="26" cy="56" r="4.5" fill="${INK}"/>
    <circle cx="44" cy="56" r="4.5" fill="${INK}"/>
    <path d="M35 38 V26" ${S}/>
    <circle cx="35" cy="21" r="5.5" ${SF(YELLOW)}/>
  </g>
  <g transform="rotate(6 88 66)">
    <rect x="66" y="48" width="46" height="40" rx="12" ${SF(LAVENDER)}/>
    <circle cx="80" cy="66" r="4.5" fill="${INK}"/>
    <circle cx="98" cy="66" r="4.5" fill="${INK}"/>
    <path d="M89 48 V36" ${S}/>
    <circle cx="89" cy="31" r="5.5" ${SF(CARD)}/>
  </g>
  <path d="M50 84 H70" ${S}/>
  <rect x="54" y="94" width="16" height="12" rx="3" ${SF(CARD)}/>
`;

/**
 * Security — an outlined padlock under a scanner beam. Deliberately NOT a shield-with-tick: a
 * shield reads as "protected/approved", and a topic label must never imply a safety verdict
 * (AGENTS.md: never call anything safe / secure / malware-free).
 */
const security = `
  <g transform="rotate(-4 56 68)">
    <path d="M36 54 V40 A20 20 0 0 1 76 40 V54" ${S}/>
    <rect x="24" y="54" width="64" height="52" rx="12" ${SF(YELLOW)}/>
    <circle cx="56" cy="74" r="8" ${SF(CARD)}/>
    <path d="M56 82 V92" ${S}/>
  </g>
  <path d="M10 24 H102" stroke="${CYAN}" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M10 24 H102" ${S}/>
  <path d="M18 34 V16 M102 34 V16" ${S}/>
  <rect x="92" y="86" width="20" height="20" rx="5" ${SF(LAVENDER)} transform="rotate(14 102 96)"/>
`;

/**
 * Uncategorized — an open, unlabelled package with a question mark. This is a real, visible state,
 * never a fallback that quietly hides a resource or flatters it into a nicer bucket.
 */
const uncategorized = `
  <g transform="rotate(-4 58 64)">
    <path d="M20 48 L58 30 L96 48 L58 66 Z" ${SF(CARD)}/>
    <path d="M20 48 V90 L58 108 V66" ${SF(PERIWINKLE)}/>
    <path d="M96 48 V90 L58 108" ${SF(CARD)}/>
  </g>
  <g transform="rotate(8 58 44)">
    <path d="M50 40 A9 9 0 1 1 59 49 V54" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="59" cy="63" r="3" fill="${INK}"/>
  </g>
`;

const ART = {
  "frontend-design": frontendDesign,
  defi,
  "smart-contracts": smartContracts,
  research,
  automation,
  "developer-tools": developerTools,
  data,
  "agents-mcp": agentsMcp,
  security,
  uncategorized,
};

/**
 * Renders one category illustration. Purely decorative: the caller ALWAYS renders the category's
 * text label alongside it (see `skill-card.mjs`), so removing colour/graphics loses no information.
 *
 * @param {string} categoryId one of `CATEGORY_ORDER` from `skill-category.mjs`
 * @param {{ className?: string }} [options]
 */
export function categoryArtSvg(categoryId, options = {}) {
  const inner = Object.hasOwn(ART, categoryId) ? ART[categoryId] : ART.uncategorized;
  const className = options.className ? ` class="${options.className}"` : "";
  return `<svg${className} viewBox="0 0 120 120" aria-hidden="true" focusable="false" role="presentation">${inner}</svg>`;
}

/** Only used by tests, to assert every classifier category has its own distinct illustration. */
export function categoryArtIds() {
  return Object.keys(ART);
}
