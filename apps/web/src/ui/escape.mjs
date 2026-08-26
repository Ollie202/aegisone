// Isomorphic (Node + browser) HTML-escaping helpers for the M9 Hub frontend.
//
// Every piece of text that ultimately came from an external/untrusted source (discovery-provider
// names/descriptions, GitHub repository names/full names, resource urls, error messages echoed
// back from the backend, etc.) must be passed through `escapeHtml` before being inserted into an
// HTML string. `safeHttpUrl` additionally guards `href`/`src` attributes: only `http:`/`https:`
// URLs are ever emitted, anything else (including `javascript:`) becomes `#`.
//
// This module intentionally has zero Node-specific syntax/imports so it can be imported directly
// both by server-side TypeScript (`apps/web/src/pages/*.ts`, via a relative import — Node's
// `--experimental-strip-types` runtime imports plain `.mjs` files unmodified) and by the browser
// (`apps/web/public/app.js`, via `<script type="module">` / dynamic `import()`), so the exact same
// escaping/rendering logic runs on both the SSR and client-side-refresh code paths — never two
// independent implementations that could drift apart.

export function escapeHtml(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Only ever emits an `http:`/`https:` URL; anything else (javascript:, data:, mailto-with-script,
 * malformed strings) becomes `#` rather than being interpolated into an `href`/`src` attribute. */
export function safeHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return "#";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "#";
    return escapeHtml(parsed.toString());
  } catch {
    return "#";
  }
}

/** Truncates a hash/digest/id for display while keeping the full value available via a `title`
 * attribute (still escaped) and a `data-full` attribute for client-side "copy full value" use. */
export function shortHash(value, keep = 10) {
  if (typeof value !== "string") return "";
  if (value.length <= keep * 2 + 1) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
