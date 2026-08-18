import type { SkillFormatIssue, SkillFormatValidation, SkillMetadata, SkillPackageEntry } from "./model.ts";

function issue(code: SkillFormatIssue["code"], message: string, line?: number): SkillFormatIssue {
  return { code, message, path: "SKILL.md", ...(line === undefined ? {} : { line }) };
}

function decodeScalar(raw: string): string {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch {
      throw new TypeError(`Invalid quoted YAML scalar: ${value}`);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

function blockScalar(lines: string[], start: number, end: number, marker: string): { value: string; nextIndex: number } {
  let nextIndex = start;
  const rawLines: string[] = [];
  while (nextIndex < end) {
    const raw = lines[nextIndex]!;
    if (raw.trim() && raw.length === raw.trimStart().length) break;
    rawLines.push(raw);
    nextIndex += 1;
  }
  const indents = rawLines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length);
  if (indents.length === 0) return { value: "", nextIndex };
  const indent = Math.min(...indents);
  const content = rawLines.map((line) => line.trim() ? line.slice(Math.min(indent, line.length)) : "");
  const style = marker[0];
  let value: string;
  if (style === "|") {
    value = content.join("\n");
  } else {
    const folded: string[] = [];
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) folded.push(paragraph.join(" "));
      paragraph = [];
    };
    for (const line of content) {
      if (line === "") {
        flush();
        folded.push("");
      } else {
        paragraph.push(line);
      }
    }
    flush();
    value = folded.join("\n");
  }
  const chomp = marker.slice(1);
  if (chomp === "+") value += "\n";
  else if (chomp !== "-") value += "\n";
  return { value, nextIndex };
}

function parseFrontmatter(text: string): { fields: Record<string, string>; metadata: Record<string, string>; body: string; issues: SkillFormatIssue[] } {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return { fields: {}, metadata: {}, body: text, issues: [issue("missing_frontmatter", "SKILL.md must start with YAML frontmatter", 1)] };
  const closeIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closeIndex < 0) return { fields: {}, metadata: {}, body: "", issues: [issue("invalid_frontmatter", "SKILL.md frontmatter is not closed with ---", 1)] };

  const fields: Record<string, string> = {};
  const metadata: Record<string, string> = {};
  const issues: SkillFormatIssue[] = [];
  let inMetadata = false;
  let index = 1;

  while (index < closeIndex) {
    const raw = lines[index]!;
    if (!raw.trim() || raw.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    const colon = trimmed.indexOf(":");
    if (colon < 1) {
      issues.push(issue("invalid_frontmatter", "Frontmatter entries must be key: value pairs", index + 1));
      index += 1;
      continue;
    }
    const key = trimmed.slice(0, colon).trim();
    const rawValue = trimmed.slice(colon + 1);

    if (indent > 0) {
      if (!inMetadata) {
        issues.push(issue("invalid_frontmatter", `Nested field ${key} is only supported under metadata`, index + 1));
        index += 1;
        continue;
      }
      if (!rawValue.trim()) {
        issues.push(issue("invalid_metadata", `metadata.${key} must be a string value`, index + 1));
        index += 1;
        continue;
      }
      try {
        metadata[key] = decodeScalar(rawValue);
      } catch (error) {
        issues.push(issue("invalid_metadata", error instanceof Error ? error.message : String(error), index + 1));
      }
      index += 1;
      continue;
    }

    inMetadata = key === "metadata";
    if (inMetadata) {
      if (rawValue.trim()) issues.push(issue("invalid_metadata", "metadata must be a mapping of string keys to string values", index + 1));
      index += 1;
      continue;
    }
    if (Object.hasOwn(fields, key)) {
      issues.push(issue("invalid_frontmatter", `Duplicate frontmatter field: ${key}`, index + 1));
      index += 1;
      continue;
    }
    const scalarMarker = rawValue.trim();
    if (/^[>|][+-]?$/.test(scalarMarker)) {
      const block = blockScalar(lines, index + 1, closeIndex, scalarMarker);
      fields[key] = block.value;
      index = block.nextIndex;
      continue;
    }
    if (!rawValue.trim()) {
      issues.push(issue("invalid_frontmatter", `${key} must be a scalar value`, index + 1));
      index += 1;
      continue;
    }
    try {
      fields[key] = decodeScalar(rawValue);
    } catch (error) {
      issues.push(issue("invalid_frontmatter", error instanceof Error ? error.message : String(error), index + 1));
    }
    index += 1;
  }
  return { fields, metadata, body: lines.slice(closeIndex + 1).join("\n"), issues };
}

export function validateSkillPackage(entries: readonly SkillPackageEntry[], directoryName: string): SkillFormatValidation {
  const skill = entries.find((entry) => entry.path === "SKILL.md");
  if (!skill) return { valid: false, metadata: null, body: null, issues: [issue("missing_skill_md", "Agent Skills require a SKILL.md file")] };

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(skill.bytes);
  } catch {
    return { valid: false, metadata: null, body: null, issues: [issue("invalid_utf8", "SKILL.md must be valid UTF-8")] };
  }

  const parsed = parseFrontmatter(text);
  const issues = [...parsed.issues];
  const name = parsed.fields.name ?? "";
  const description = parsed.fields.description ?? "";
  const compatibility = parsed.fields.compatibility;

  if (!name || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.includes("--")) {
    issues.push(issue("invalid_name", "name must be 1-64 lowercase alphanumeric/hyphen characters with no edge or consecutive hyphens"));
  } else if (name !== directoryName) {
    issues.push(issue("name_directory_mismatch", `name ${JSON.stringify(name)} must match parent directory ${JSON.stringify(directoryName)}`));
  }
  if (!description || description.length > 1024) {
    issues.push(issue("invalid_description", "description must be 1-1024 characters"));
  }
  if (compatibility !== undefined && (!compatibility || compatibility.length > 500)) {
    issues.push(issue("invalid_compatibility", "compatibility must be 1-500 characters when present"));
  }

  const known = new Set(["name", "description", "license", "compatibility", "allowed-tools"]);
  const unknownFields = Object.fromEntries(Object.entries(parsed.fields).filter(([key]) => !known.has(key)));
  const metadata: SkillMetadata | null = name || description
    ? {
        name,
        description,
        ...(parsed.fields.license === undefined ? {} : { license: parsed.fields.license }),
        ...(compatibility === undefined ? {} : { compatibility }),
        ...(parsed.fields["allowed-tools"] === undefined ? {} : { allowedTools: parsed.fields["allowed-tools"] }),
        metadata: parsed.metadata,
        unknownFields,
      }
    : null;

  return { valid: issues.length === 0, metadata, body: parsed.body, issues };
}
