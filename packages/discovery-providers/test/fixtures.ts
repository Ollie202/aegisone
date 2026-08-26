/**
 * Recorded fixtures from live GitHub Agent Finder and Hugging Face Discover responses,
 * captured 2026-08-26 against the pinned contracts recorded in `../src/constants.ts`.
 * Unit tests use only these deterministic fixtures; live network calls are exercised
 * separately by `test/live/*.live.test.ts`.
 */

// POST https://agentfinder.github.com/api/v1/search
// body: {"query":{"text":"deploy a secure Next.js application"},"pageSize":3}
export const GITHUB_AGENT_FINDER_FIXTURE_RESPONSE = {
  // The real live response includes an opaque pagination cursor here. Replaced with a short
  // placeholder (not a secret; M8.3 does not use pagination) to avoid tripping high-entropy
  // secret scanners on a harmless recorded fixture value.
  pageToken: "test-fixture-page-token",
  results: [
    {
      capabilities: ["deploy applications", "deploy websites to vercel"],
      description: "Deploy applications and websites to Vercel.",
      displayName: "Vercel Deploy",
      identifier: "urn:ai:github.com:openai:skills:vercel-deploy",
      mediaType: "application/ai-skill",
      metadata: { repoPath: "skills/.curated/vercel-deploy/SKILL.md", sourceSet: "openai/skills" },
      representativeQueries: ["deploy an application to Vercel", "how to deploy a website to Vercel"],
      score: 80,
      source: "launch-augment-set",
      tags: ["deployment", "applications", "websites", "vercel"],
      type: "application/ai-skill",
      url: "https://github.com/openai/skills/blob/main/skills/.curated/vercel-deploy/SKILL.md",
    },
    {
      capabilities: ["deploy applications to render", "analyze codebases", "generate render.yaml blueprints", "provide dashboard deeplinks"],
      description: "Deploy applications to Render by analyzing codebases, generating render.yaml Blueprints, and providing Dashboard deeplinks.",
      displayName: "Render Deploy",
      identifier: "urn:ai:github.com:openai:skills:render-deploy",
      mediaType: "application/ai-skill",
      metadata: { repoPath: "skills/.curated/render-deploy/SKILL.md", sourceSet: "openai/skills" },
      representativeQueries: ["how to deploy an application to Render", "generate a render.yaml Blueprint for my project", "provide a Dashboard deeplink for my application"],
      score: 75,
      source: "launch-augment-set",
      tags: ["deployment", "applications", "render", "code analysis", "blueprints"],
      type: "application/ai-skill",
      url: "https://github.com/openai/skills/blob/main/skills/.curated/render-deploy/SKILL.md",
    },
    {
      capabilities: ["deploy applications to cloudflare", "deploy infrastructure to cloudflare", "use workers", "use pages", "use related platform services"],
      description: "Deploy applications and infrastructure to Cloudflare using Workers, Pages, and related platform services.",
      displayName: "Cloudflare Deploy",
      identifier: "urn:ai:github.com:openai:skills:cloudflare-deploy",
      mediaType: "application/ai-skill",
      metadata: { repoPath: "skills/.curated/cloudflare-deploy/SKILL.md", sourceSet: "openai/skills" },
      representativeQueries: ["how to deploy an application to Cloudflare", "deploy infrastructure using Cloudflare Workers", "what are Cloudflare Pages for deployment"],
      score: 70,
      source: "launch-augment-set",
      tags: ["cloudflare", "deployment", "applications", "infrastructure"],
      type: "application/ai-skill",
      url: "https://github.com/openai/skills/blob/main/skills/.curated/cloudflare-deploy/SKILL.md",
    },
  ],
};

// POST https://huggingface-hf-discover.hf.space/search
// body: {"query":{"text":"upload files to a dataset repo"},"pageSize":3}
export const HUGGING_FACE_DISCOVER_FIXTURE_RESPONSE = {
  results: [
    {
      identifier: "urn:air:github.com:huggingface:skills:huggingface-datasets",
      displayName: "huggingface-datasets",
      type: "application/ai-skill",
      url: "https://github.com/huggingface/skills/tree/main/skills/huggingface-datasets",
      description: "Use this skill for Hugging Face Dataset Viewer API workflows that fetch subset/split metadata, paginate rows, search text, apply filters, download parquet URLs, and read size or statistics.",
      tags: ["huggingface", "skills"],
      metadata: {
        sourceType: "huggingface-skills",
        publisher: "huggingface/skills",
        rankingScore: 0.9933270054171693,
        sourceUrl: "https://github.com/huggingface/skills/tree/main/skills/huggingface-datasets",
        id: "huggingface-skills-skills-huggingface-datasets-skill-md-004-000",
        repo: "huggingface/skills",
        skill: "huggingface-datasets",
        skill_name: "huggingface-datasets",
        path: "skills/huggingface-datasets",
        raw_url: "https://raw.githubusercontent.com/huggingface/skills/main/skills/huggingface-datasets/SKILL.md",
        kind: "skill_section",
        title: "Creating and Uploading Datasets",
        heading_path: ["Hugging Face Dataset Viewer", "Creating and Uploading Datasets"],
        version: "1.0.25",
        updated_at: "2026-08-18T17:35:09+02:00",
        ordinal: 4,
        part: 0,
      },
      score: 99,
      source: "https://github.com/huggingface/skills",
    },
    {
      identifier: "urn:air:github.com:huggingface:skills:huggingface-llm-trainer",
      displayName: "huggingface-llm-trainer",
      type: "application/ai-skill",
      url: "https://github.com/huggingface/skills/tree/main/skills/huggingface-llm-trainer",
      description: "Train or fine-tune language and vision models using TRL (Transformer Reinforcement Learning) or Unsloth with Hugging Face Jobs infrastructure.",
      tags: ["huggingface", "skills"],
      metadata: { sourceType: "huggingface-skills", publisher: "huggingface/skills", rankingScore: 0.9932937395027559 },
      score: 99,
      source: "https://github.com/huggingface/skills",
    },
    {
      identifier: "urn:air:github.com:huggingface:skills:hf-cli",
      displayName: "hf-cli",
      type: "application/ai-skill",
      url: "https://github.com/huggingface/skills/tree/main/skills/hf-cli",
      description: "Hugging Face Hub CLI (`hf`) for downloading, uploading, and managing models, datasets, spaces, buckets, repos, papers, jobs, and more on the Hugging Face Hub.",
      tags: ["huggingface", "skills"],
      metadata: { sourceType: "huggingface-skills", publisher: "huggingface/skills", rankingScore: 0.9905087171480614 },
      score: 99,
      source: "https://github.com/huggingface/skills",
    },
  ],
  referrals: [
    {
      identifier: "urn:air:huggingface.co:registry:spaces",
      displayName: "Hugging Face Spaces Registry",
      type: "application/ai-registry+json",
      url: "https://huggingface-hf-discover.hf.space/registries/huggingface/spaces/search",
      description: "Search generated skills, Space descriptors, and MCP entries from running Hugging Face Spaces.",
      tags: ["huggingface", "spaces", "registry"],
    },
  ],
};
