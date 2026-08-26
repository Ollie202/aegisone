// Isomorphic policy-playground form rendering (see escape.mjs header). Pure markup only — no
// values here are ever treated as a policy decision themselves; the actual decision always comes
// back from `POST /api/v1/policy/evaluate` and is rendered by policy-result.mjs.

import { escapeHtml } from "./escape.mjs";

const SOURCE_ASSURANCE_LEVELS = ["NONE", "DECLARED", "REPOSITORY_AUTHENTICATED", "SIGNED_RELEASE"];
const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

function optionsHtml(values, selected, placeholderLabel) {
  const placeholder = placeholderLabel ? `<option value="">${escapeHtml(placeholderLabel)}</option>` : "";
  return placeholder + values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

export function policyFormHtml(policy = {}) {
  const requireMatch = policy.requireCorrespondence === "MATCH";
  const missingEvidenceDecision = policy.missingEvidenceDecision ?? "REVIEW";
  return `<form class="policyForm" id="policy-form" data-resource-id="${escapeHtml(policy.resourceId ?? "")}">
    <div class="policyField">
      <label for="policy-min-assurance">Minimum source assurance</label>
      <select id="policy-min-assurance" name="minimumSourceAssurance">${optionsHtml(SOURCE_ASSURANCE_LEVELS, policy.minimumSourceAssurance, "(no minimum)")}</select>
    </div>
    <div class="policyField policyField--checkbox">
      <label><input type="checkbox" id="policy-require-match" name="requireCorrespondence" ${requireMatch ? "checked" : ""}> Require distribution correspondence MATCH</label>
    </div>
    <div class="policyField">
      <label for="policy-max-severity">Maximum security severity</label>
      <select id="policy-max-severity" name="maximumAuditSeverity">${optionsHtml(SEVERITIES, policy.maximumAuditSeverity, "(no maximum)")}</select>
    </div>
    <div class="policyField">
      <label for="policy-max-age">Maximum evidence age (hours)</label>
      <input type="number" min="1" step="1" id="policy-max-age" name="maximumEvidenceAgeHours" value="${policy.maximumEvidenceAgeHours ? escapeHtml(String(policy.maximumEvidenceAgeHours)) : ""}" placeholder="(no maximum)">
    </div>
    <div class="policyField">
      <label for="policy-missing-evidence">Missing evidence behavior</label>
      <select id="policy-missing-evidence" name="missingEvidenceDecision">
        <option value="REVIEW"${missingEvidenceDecision === "REVIEW" ? " selected" : ""}>REVIEW</option>
        <option value="DENY"${missingEvidenceDecision === "DENY" ? " selected" : ""}>DENY</option>
      </select>
    </div>
    <button type="submit" class="button button--primary">Evaluate policy</button>
  </form>`;
}

/** Reads the form's current values into a `TrustPolicy`-shaped object
 * (`@proofrail/capability-model`). Isomorphic so both the server (rendering a pre-filled form from
 * a query string) and the browser (reading `FormData` before `POST /api/v1/policy/evaluate`) use
 * the identical construction rule. */
export function policyFromFormValues(values) {
  const policy = { schemaVersion: "1", missingEvidenceDecision: values.missingEvidenceDecision === "DENY" ? "DENY" : "REVIEW" };
  if (values.minimumSourceAssurance) policy.minimumSourceAssurance = values.minimumSourceAssurance;
  if (values.requireCorrespondence) policy.requireCorrespondence = "MATCH";
  if (values.maximumAuditSeverity) policy.maximumAuditSeverity = values.maximumAuditSeverity;
  const age = Number(values.maximumEvidenceAgeHours);
  if (values.maximumEvidenceAgeHours && Number.isFinite(age) && age > 0) policy.maximumEvidenceAgeHours = age;
  return policy;
}
