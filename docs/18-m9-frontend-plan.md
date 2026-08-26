# M9 Frontend Plan — AegisOne Hub

**Start condition:** do not implement this until M8 backend is frozen and the controlled substitution vertical slice is proven.

## Goal

Build the human-facing AegisOne Hub on top of the stable backend APIs without moving trust logic into the browser.

The frontend should let a judge/user understand three things within seconds:

1. what capabilities are available;
2. what AegisOne actually knows about a selected capability;
3. why a consumer policy allowed/reviewed/denied it.

## UX principle

The product is not a generic marketplace with a green trust badge.

The primary visual grammar should expose independent evidence dimensions:

```text
Discovery:       INDEXED
Source:          REPOSITORY_AUTHENTICATED
Inspection:      INSPECTED
Correspondence:  MATCH
Security:        HIGH (2 findings)
Evidence:        AVAILABLE · 18m old
Policy:          REVIEW
```

Never collapse these into `SAFE`, `TRUSTED`, or a single numeric trust score.

## Primary pages

### 1. Hub / Search

Route concept:

```text
/
```

Main interaction:

> What capability does your agent need?

Examples:

- Review a pull request
- Audit a Solidity contract
- Deploy a Next.js app
- Analyze a repository

Search calls backend `POST /search`.

Result cards show only enough evidence to compare candidates:

- resource name/type;
- short description;
- provider/source attribution;
- discovery state;
- source-assurance label if AegisOne evidence exists;
- correspondence state if evaluated;
- highest security severity if audited;
- evidence freshness;
- relevance visually separated/labeled as relevance only.

Do not fetch arbitrary upstream URLs directly from the browser just to render cards.

### 2. Resource / Evidence Passport

Route concept:

```text
/resources/:resourceId
```

Backed by:

```text
GET /api/v1/resources/:resourceId
GET /api/v1/resources/:resourceId/evidence
```

Sections:

#### Capability

- name/type/version;
- publisher/display identity;
- provider discovery sources;
- capabilities/tags.

#### Source assurance

- assurance level;
- repository;
- stable repository identity where useful;
- exact commit;
- source subdirectory;
- authenticated GitHub identity/permission observation for repository-authenticated claims;
- authentication timestamp;
- source claim digest.

#### Distribution correspondence

- distributed artifact reference;
- publisher/distribution SHA-256;
- independently reproduced SHA-256;
- `MATCH`, `MISMATCH`, `DIVERGED`, `INSUFFICIENT_EVIDENCE`, or not evaluated;
- do not show `MATCH` if backend does not provide validated evidence.

#### Security audit

- analysis kind;
- highest severity;
- finding count;
- individual deterministic findings;
- explicit copy that no findings is not proof of safety.

#### Independent execution

- 0G Sandbox information that is genuinely available;
- preserve current TEE/provider evidence limitation language;
- never claim artifact-output TEE binding unless evidence actually supports it.

#### Canonical evidence

- canonical evidence digest;
- verification time;
- 0G Storage root/transaction;
- registry record/transaction;
- direct explorer/evidence links where safe.

#### Verification history

If backend exposes multiple versions/verifications:

```text
v1.0 MATCH
v1.1 MATCH
v1.2 MISMATCH
v1.3 MATCH
```

History is extremely useful for making AegisOne feel like infrastructure instead of one-off scanning.

### 3. Source Claim / Publisher flow

Route concept:

```text
/source/claim
```

Only after GitHub App backend flow exists.

Steps:

1. Connect/authenticate GitHub.
2. Select an accessible repository from backend-provided list.
3. Select/provide exact commit (UI can resolve branch/tag to exact commit through backend but security record stores SHA only).
4. Optional subdirectory.
5. Provide distribution artifact URL/upload/reference + digest when correspondence verification is desired.
6. Preview exact source claim.
7. Authenticate claim.
8. Show resulting `REPOSITORY_AUTHENTICATED` evidence and claim digest.
9. If requested/authorized, queue verification separately.

Do not imply GitHub connection automatically makes every discovered resource from that account authenticated.

### 4. Policy Playground

Could be embedded in Passport rather than separate page.

UI controls:

- minimum source assurance;
- require `MATCH`;
- maximum security severity;
- maximum evidence age;
- missing evidence => REVIEW or DENY.

Calls:

`POST /api/v1/policy/evaluate`

Render backend reasons exactly; browser must not independently reinterpret evidence into a different policy result.

## Judge demo mode

M9 should optimize one short path:

1. Search `pull request review`.
2. Open real AegisOne-verified Skill.
3. Show repository-authenticated source + exact commit.
4. Show genuine distribution `MATCH` from 0G reproduction.
5. Show separate security findings.
6. Trigger/view controlled substituted distribution.
7. Show `MISMATCH`.
8. Run policy requiring `MATCH` and show `DENY`.
9. Open 0G evidence.

This should fit 90–120 seconds without tiny text or long scrolling.

## Frontend technology decision

Do not force a framework migration before backend freeze. The current `apps/web` is a lightweight Node-rendered application.

At M9 kickoff, Codex should evaluate the smallest coherent option:

### Option A — evolve current app

Best if UI remains relatively small and server-rendered/static HTML is enough.

Pros:

- minimal deployment change;
- no new service;
- reuses existing Railway app;
- smaller bundle/dependency surface.

### Option B — introduce a modern frontend framework inside the same app/service

Only if the Hub interactions genuinely justify it.

If chosen:

- document ADR;
- keep backend API/service logic separate from components;
- keep one Railway `proofrail-app` service;
- no trust logic in client state;
- preserve mobile-first render and fast demo path.

Do not create a separate frontend hosting topology solely for aesthetics unless explicitly approved.

## Visual direction

The existing AegisOne proof-first dark visual language can evolve rather than reset.

Desired feeling:

- infrastructure-grade;
- evidence-forward;
- readable technical detail;
- not generic Web3 neon;
- not an App Store clone;
- strong state labels and hashes without overwhelming casual viewers.

Use color only as an aid; state must remain understandable from text/icons for accessibility.

## Data-loading rules

- browser consumes AegisOne backend, not raw Supabase;
- no GitHub client secret or 0G secret in frontend env;
- source-auth session remains server-side/HttpOnly where possible;
- pagination/search debounce to avoid upstream flooding;
- render provider outage separately from trust evidence;
- sanitize all external descriptions/names/URLs before HTML insertion;
- do not render upstream HTML/Markdown unsanitized.

## Frontend MVP acceptance

- [ ] mobile-first capability search works against real federated backend;
- [ ] result cards visibly distinguish indexed/unverified from proven evidence;
- [ ] Evidence Passport renders all independent trust dimensions;
- [ ] source-auth claim flow can complete through real GitHub App backend;
- [ ] deterministic policy playground works;
- [ ] genuine and substituted demo states are easy to switch/show without fake data;
- [ ] 0G evidence links work;
- [ ] no generic `SAFE` badge or invented trust score;
- [ ] frontend contains no secret-bearing code;
- [ ] accessibility/readability acceptable on phone and desktop;
- [ ] 90–120 second judge demo rehearsed end-to-end;
- [ ] all rendered proof claims match backend/canonical evidence.
