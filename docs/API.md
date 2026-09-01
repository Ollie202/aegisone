# API surface

This is the compact current surface. Read the code/tests for exact schemas; do not create another contract document for every change.

## Human routes

- `GET /` — Skills
- `GET /audit` — Audit Lab (`/scan` remains an alias)
- `GET /verified` — Verified Library
- `GET /agents` — For Agents
- `GET /resources/:resourceId` — Evidence Passport
- `GET /proof` — historical proof-first evidence page

## Discovery

- `GET /.well-known/ai-catalog.json`
- `POST /search`

Discovery results are not trust evidence.

## Audit / verification

- `POST /api/v1/scan` — deterministic Agent Skill screening; optional advisory output stays separate
- `POST /api/v1/verify` — bounded package/artifact verification for a catalog resource with a recorded exact immutable source target

The verify caller supplies a catalog `resourceId`; it must not become a generic caller-controlled repository/URL fetcher.

## Resources / evidence / policy

- `GET /api/v1/resources/:resourceId`
- `GET /api/v1/resources/:resourceId/versions/:versionId`
- `GET /api/v1/resources/:resourceId/evidence`
- `POST /api/v1/policy/evaluate`

Policy is deterministic and uses explicit evidence dimensions, never relevance/category scores.

## MCP

Transport: `POST /mcp`

Tools:

- `aegisone_search`
- `aegisone_inspect`
- `aegisone_evaluate`
- `aegisone_scan`

There is no generic install, execute or sign MCP tool.

## Publishing

- `POST /api/v1/publish` — operator-gated public-app trigger; absent/refused when not configured
- worker `POST /internal/publish-evidence` — authenticated internal fixed-shape publication route

Publishing can spend project resources and must remain protected. A caller must never be able to provide arbitrary signing calldata, destinations, commands or URLs.

## Source-auth compatibility surface

The GitHub source-claim machinery still exists for evidence workflows but is not part of the normal primary navigation:

- `GET /auth/github/start`
- `GET /auth/github/callback`
- `GET /api/v1/source-auth/github/repositories`
- `POST /api/v1/source-claims`
- `GET /api/v1/source-claims/:claimId`

Do not re-center the ordinary user experience around GitHub OAuth/source-claim jargon unless the product direction explicitly changes.
