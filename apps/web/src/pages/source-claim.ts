import { renderLayoutHtml } from "./layout.ts";

export interface SourceClaimPageState {
  githubConfigured: boolean;
}

export function renderSourceClaimPageHtml(state: SourceClaimPageState): string {
  const unavailableNote = !state.githubConfigured
    ? `<div class="demoBanner">The GitHub App has not been configured on this deployment yet (GITHUB_APP_CLIENT_ID / GITHUB_APP_CLIENT_SECRET / GITHUB_OAUTH_CALLBACK_URL / GITHUB_OAUTH_STATE_SECRET). "Connect GitHub" is unavailable, but a DECLARED source claim (without authenticated repository authority) still works below.</div>`
    : "";

  const body = `
    <span class="edgeLabel">03 / Source claim</span>
    <div class="pillRow">
      <span class="pill">GitHub authority</span>
      <span class="pill pill--peri">Exact commit SHA</span>
    </div>
    <h1 class="tight">Prove the <span class="mark mark--yellow">source</span>, not the story.</h1>
    <p class="lede">Authenticate an exact GitHub source claim for a resource. Connecting GitHub authenticates only the specific repository and commit you claim here — never every resource discovered from your account.</p>
    ${unavailableNote}
    <ol class="stepList">
      <li>
        <strong>Connect GitHub</strong>
        <p>Sign in with GitHub so AegisOne can check your effective write/admin authority over the repository you claim.</p>
        <button type="button" class="button button--primary" id="connect-github"${state.githubConfigured ? "" : " disabled"}>Connect GitHub</button>
        <span id="github-session-status" class="cardNote"></span>
      </li>
      <li>
        <strong>Select repository</strong>
        <p>Only repositories your GitHub session can access are listed. Private repositories are unsupported in M8 and are shown but disabled.</p>
        <div id="repository-list"><p class="emptyState">Connect GitHub to list accessible repositories, or provide a repository below without connecting for a DECLARED claim.</p></div>
      </li>
      <li>
        <strong>Claim details</strong>
        <p>Provide the resource this claim is for, the exact repository, and (optionally) commit/subdirectory/distribution reference.</p>
        <form class="formGrid" id="claim-form">
          <div><label for="claim-resource-id">Resource id</label><input type="text" id="claim-resource-id" name="resourceId" required placeholder="agentic_resources.id"></div>
          <div><label for="claim-version-id">Resource version id</label><input type="text" id="claim-version-id" name="resourceVersionId" required placeholder="resource_versions.id"></div>
          <div><label for="claim-repo">Repository (owner/repo)</label><input type="text" id="claim-repo" name="repositoryFullName" required placeholder="owner/repo"></div>
          <div><label for="claim-ref">Branch or tag (resolved to exact commit server-side)</label><input type="text" id="claim-ref" name="ref" placeholder="main"></div>
          <div><label for="claim-subdir">Subdirectory (optional)</label><input type="text" id="claim-subdir" name="subdirectory"></div>
          <div><label for="claim-dist-url">Distribution URL (optional, https only)</label><input type="url" id="claim-dist-url" name="distributionUrl"></div>
          <div><label for="claim-dist-sha">Distribution SHA-256 (optional)</label><input type="text" id="claim-dist-sha" name="distributionSha256"></div>
        </form>
      </li>
      <li>
        <strong>Preview</strong>
        <p>Reflects exactly what will be submitted — the source-of-truth commit/digest is always resolved and stored server-side, never accepted as-typed.</p>
        <pre id="claim-preview" class="claimPreview"></pre>
      </li>
      <li>
        <strong>Authenticate claim</strong>
        <button type="button" class="button button--primary" id="submit-claim">Create source claim</button>
        <div id="claim-result" style="margin-top:12px"></div>
      </li>
    </ol>
  `;

  return renderLayoutHtml({
    title: "Source claim — AegisOne Hub",
    activeNav: "source-claim",
    bodyHtml: body,
    scriptTag: `<script type="module" src="/static/app.js" data-page="source-claim"></script>`,
  });
}
