import type { ArdResourceMediaType } from "./constants.ts";
import type { ArdSearchResponse, LocalCatalogRecord, ParsedArdSearchRequest } from "./types.ts";
import { assertAbsoluteHttpUrl } from "./validate.ts";

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized === "" ? [] : [...new Set(normalized.split(" "))];
}

function relevanceScore(queryText: string, record: LocalCatalogRecord): number {
  const query = normalizeText(queryText);
  const queryTokens = tokens(query);
  const allText = normalizeText(record.searchableText);
  const allTokens = new Set(tokens(allText));
  const nameTokens = new Set(tokens(record.entry.displayName));
  const matched = queryTokens.filter((token) => allTokens.has(token)).length;
  if (matched === 0) return 0;

  const coverage = matched / queryTokens.length;
  const nameCoverage = queryTokens.filter((token) => nameTokens.has(token)).length / queryTokens.length;
  const phraseBonus = allText.includes(query) ? 20 : 0;
  return Math.min(100, Math.round(coverage * 65 + nameCoverage * 15 + phraseBonus));
}

export function searchLocalCatalog(
  request: ParsedArdSearchRequest,
  records: readonly LocalCatalogRecord[],
  source: string,
): ArdSearchResponse {
  assertAbsoluteHttpUrl(source, "search result source");
  const allowedTypes = request.mediaTypes === null ? null : new Set(request.mediaTypes);

  const results = records
    .filter((record) => allowedTypes === null || allowedTypes.has(record.entry.type as ArdResourceMediaType))
    .map((record) => ({ record, score: relevanceScore(request.text, record) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.record.entry.identifier.localeCompare(right.record.entry.identifier))
    .slice(0, request.pageSize)
    .map(({ record, score }) => ({
      ...structuredClone(record.entry),
      score,
      source,
    }));

  return { results, referrals: [] };
}

export const ardSearchText = {
  normalize: normalizeText,
  score: relevanceScore,
} as const;
