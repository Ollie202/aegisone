import type { CapabilityResource, CapabilityResourceKind } from "../../capability-model/src/model.ts";
import { capabilityResourceToArdEntry } from "./mapping.ts";
import type { LocalCatalogRecord } from "./types.ts";

const DISCOVERED_AT = "2026-08-24T00:00:00.000Z";

interface FixtureDefinition {
  id: string;
  identifier: string;
  kind: CapabilityResourceKind;
  name: string;
  description: string;
  resourceUrl: string;
  version: string;
  tags: string[];
  capabilities: string[];
  representativeQueries: string[];
}

const FIXTURES: readonly FixtureDefinition[] = [
  {
    id: "fixture:skill:pull-request-reviewer",
    identifier: "urn:air:proofrail.example:skill:pull-request-reviewer",
    kind: "agent-skill",
    name: "Pull Request Reviewer Skill",
    description: "Reviews pull requests and summarizes deterministic code-quality findings.",
    resourceUrl: "https://catalog.proofrail.example/skills/pull-request-reviewer",
    version: "1.0.0",
    tags: ["code-review", "git", "pull-request"],
    capabilities: ["PullRequestReview", "CodeQualitySummary"],
    representativeQueries: [
      "review my pull request",
      "find a skill that summarizes code review findings",
    ],
  },
  {
    id: "fixture:mcp:weather",
    identifier: "urn:air:proofrail.example:mcp:weather-observer",
    kind: "mcp-server",
    name: "Weather Observer MCP Server",
    description: "Provides current weather observations and short-range forecasts through MCP tools.",
    resourceUrl: "https://catalog.proofrail.example/mcp/weather-observer.json",
    version: "1.0.0",
    tags: ["weather", "forecast", "mcp"],
    capabilities: ["CurrentWeather", "WeatherForecast"],
    representativeQueries: [
      "what is the weather in Lagos",
      "find an MCP server for a five day forecast",
    ],
  },
  {
    id: "fixture:a2a:travel-planner",
    identifier: "urn:air:proofrail.example:a2a:travel-planner",
    kind: "a2a-agent",
    name: "Travel Planning A2A Agent",
    description: "Builds travel itineraries and coordinates flight and accommodation research.",
    resourceUrl: "https://catalog.proofrail.example/a2a/travel-planner.json",
    version: "1.0.0",
    tags: ["travel", "itinerary", "a2a"],
    capabilities: ["ItineraryPlanning", "TravelResearch"],
    representativeQueries: [
      "plan a trip to Tokyo",
      "find an agent that builds a travel itinerary",
    ],
  },
  {
    id: "fixture:api:invoice-extraction",
    identifier: "urn:air:proofrail.example:api:invoice-extraction",
    kind: "api",
    name: "Invoice Extraction API",
    description: "Extracts structured invoice fields through a documented OpenAPI interface.",
    resourceUrl: "https://catalog.proofrail.example/apis/invoice-extraction.openapi.json",
    version: "1.0.0",
    tags: ["invoice", "document", "openapi"],
    capabilities: ["InvoiceFieldExtraction", "DocumentParsing"],
    representativeQueries: [
      "extract fields from an invoice",
      "find an API for parsing invoice documents",
    ],
  },
] as const;

function unverifiedResource(fixture: FixtureDefinition): CapabilityResource {
  return {
    schemaVersion: "1",
    id: fixture.id,
    kind: fixture.kind,
    name: fixture.name,
    description: fixture.description,
    discovery: {
      status: "INDEXED",
      source: "proofrail-local-catalog",
      sourceResourceId: fixture.identifier,
      resourceUrl: fixture.resourceUrl,
      discoveredAt: DISCOVERED_AT,
    },
    currentVersion: {
      id: `${fixture.id}@${fixture.version}`,
      versionLabel: fixture.version,
      source: null,
      distribution: null,
    },
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
}

export function createLocalCatalog(): LocalCatalogRecord[] {
  return FIXTURES.map((fixture) => {
    const resource = unverifiedResource(fixture);
    const entry = capabilityResourceToArdEntry(resource, {
      tags: fixture.tags,
      capabilities: fixture.capabilities,
      representativeQueries: fixture.representativeQueries,
    });
    return {
      resource,
      entry,
      searchableText: [
        entry.displayName,
        entry.description,
        ...(entry.tags ?? []),
        ...(entry.capabilities ?? []),
        ...(entry.representativeQueries ?? []),
      ].filter((value): value is string => value !== undefined).join(" "),
    };
  });
}
