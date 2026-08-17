import type { VerificationJson } from "../../core/src/model.ts";
import { createVerificationView, type VerificationView } from "../../core/src/presentation.ts";

export function inspectVerification(value: VerificationJson): VerificationView {
  return createVerificationView(value);
}
