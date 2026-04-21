# Briefing: MCP OAuth on vade-mcp for Claude.ai

**Date**: 2026-04-21
**Author**: Claude Code session (Opus 4.7, 1M ctx) running in an
Anthropic cloud environment scoped to `vade-app/vade-core`;
session-scoped kernel agent; task brought by Ven via PR #50
review.

## Who's who
- **Principal**: Ven (operator, BDFL for VADE).
- **Author**: Claude Code session scoped to `vade-app/vade-core`
  only. Cannot read `vade-runtime`, `vade-coo-memory`, or other
  vade-app repos.
- **Recipient (COO)**: Claude instance with cross-repo access
  and visibility into deploy, governance, and runtime concerns.
  Asked to design the **minimum-viable** OAuth surface that
  unblocks Claude.ai without breaking existing clients.

## What vade-mcp is (30 seconds)

`vade-mcp` is the hosted MCP server for the VADE canvas. It runs
on Fly.io at `https://mcp.vade-app.dev`, speaks MCP over SSE at
`/sse`, and is gated by static bearer tokens (see
[`docs/auth.md`](../auth.md)). Today's supported clients are
Claude Desktop, Claude Code, and the iPad PWA — each paste the
same operator token into an `Authorization: Bearer …` header.
Wiring is documented in
[`docs/mcp-connector.md`](../mcp-connector.md).

## The problem

Claude.ai's **"Add custom connector"** UI requires OAuth 2.0. A
user who pastes `https://mcp.vade-app.dev/sse` gets a connection
error because the Claude.ai UI probes for OAuth discovery
metadata (`/.well-known/oauth-authorization-server`, dynamic
client registration, `/authorize`, `/token`) and our server
responds 404 to every one of those. The server does not speak
OAuth in any form.

PR #50's commit 58085ca documented Claude.ai as "not currently
supported" as an honest short-term fix. Tracking issue is
**#57** ("Implement MCP OAuth authorization server on vade-mcp
for Claude.ai compatibility"). Claude.ai users are locked out of
the hosted canvas until this is implemented.

## What's been decided directionally

This is the author's best framing inside a one-repo session.
The recipient is expected to re-examine it.

1. **Implement the MCP authorization spec** on `vade-mcp`,
   exposing the minimum endpoints Claude.ai's UI demands —
   discovery, dynamic client registration, authorize, token.
   Reference: <https://modelcontextprotocol.io/specification/basic/authorization>.
2. **Exploit the single-operator deployment.** There is one
   principal (Ven). The consent step in `/authorize` can be a
   one-button "authorize this connection" rather than a real
   user/account UI. Client registration can accept any request
   but hand out credentials that are worthless without Ven's
   operator bearer.
3. **Map OAuth tokens onto the existing operator principal** in
   `mcp/auth.ts`, so Claude.ai's post-OAuth requests hit the
   same authorization code path as today's bearer clients. This
   keeps Claude Desktop / Claude Code / iPad PWA unchanged
   through and after the rollout.
4. **Alternative under-explored by the author**: put a generic
   OAuth-aware proxy (Cloudflare Access, `oauth2-proxy`, or
   equivalent) in front of `vade-mcp` and keep the Fly server
   bearer-only. This may dominate the custom implementation on
   surface area and maintenance cost — but it may also interact
   badly with today's bearer clients, which this session cannot
   verify.

Trade-offs the author already surfaced:

- OAuth adds real surface area — `/authorize` and `/token` are
  security-sensitive by definition. Anything we do must age
  well under token rotation and server restart.
- Dynamic client registration is effectively open (anyone can
  register a client), so bootstrap-anchor trust lives at the
  `/authorize` consent step.
- The existing bearer-token model is simple and working; any
  OAuth implementation should be **additive**, not replacing,
  for at least the first rollout.

## Your task

Design the **minimum-viable** OAuth surface that:

1. Lets Claude.ai complete the "Add custom connector" flow end
   to end against `mcp.vade-app.dev` and surfaces the
   `vade-canvas` tools.
2. Does not break Claude Desktop, Claude Code, or the iPad PWA
   at any point during rollout.
3. Fits the single-operator trust model — no user database, no
   multi-tenant identity.

Optimize for three axes, in order:

- **Surface area** — how many new endpoints, how much new code,
  how much new state.
- **Secret-rotation story** — OAuth-issued tokens must not
  create a parallel rotation regime that diverges from
  `auth.md`.
- **Deploy blast radius** — the rollout must be safely
  reversible on the Fly service.

## Constraints

- `vade-core` is the author's autonomy scope. Any server-side
  code lands under `mcp/`; deploy runs through the existing
  `.github/workflows/mcp-deploy.yml`.
- `docs/auth.md` is the canonical trust-model document. Any
  change to the surface requires a matching update there.
- Do not rotate away from the single-operator model.
- No client-side changes in `src/` unless the OAuth flow
  strictly requires them.
- Ven approves merges to `main`.

## Read first

1. [`CLAUDE.md`](../../CLAUDE.md) — repo scope and conventions.
2. [`docs/auth.md`](../auth.md) — token model, rotation, threat
   model.
3. [`docs/mcp-connector.md`](../mcp-connector.md) — post-58085ca
   client setup, including the "Claude.ai not supported" note.
4. `mcp/index.ts` — HTTP routing today (`/sse`, `/messages`,
   `/healthz`, `/canvas`).
5. `mcp/auth.ts` — where OAuth tokens would map onto the
   existing principal.
6. Issue [#57](https://github.com/vade-app/vade-core/issues/57)
   — tracker for this work.
7. <https://modelcontextprotocol.io/specification/basic/authorization> —
   MCP authorization spec.
8. Claude.ai connector documentation (Anthropic-side; author has
   no access from this session).

## Deliverable

A written plan Ven reviews. No code yet. The plan should cover:

- Endpoint spec: paths, request/response shapes, error cases.
- Consent-step UX: minimum Claude.ai will accept; single-operator
  simplification.
- Token lifecycle: how OAuth tokens map to `mcp/auth.ts`'s
  principal; rotation cadence; revocation path.
- Deploy sequence: feature-flagged rollout, how to verify the
  Claude.ai flow works end-to-end without breaking bearer
  clients.
- Recommendation on the custom-OAuth-server vs
  OAuth-proxy-in-front decision, with reasoning.

## Known bounds of this briefing

The author is aware of the following bounds and expects the
recipient to challenge them:

- **Repo visibility.** The author can only read `vade-core`.
  `vade-runtime`, `vade-coo-memory`, and other `vade-app` repos
  are invisible. Any cross-repo implication below is inferred,
  not verified.
- **Claude.ai probe sequence.** The author does not know the
  exact order of requests Claude.ai makes, the metadata fields
  it requires, or how it handles timeouts / redirects. The
  recipient should get this from Anthropic-side docs or by
  instrumenting the Fly server against a live probe.
- **Framing anchor.** The author may be anchored on "implement
  OAuth endpoints in `vade-mcp`." The OAuth-proxy path deserves
  serious evaluation — it may be strictly better on all three
  optimization axes.
- **Cloudflare Access interaction.** If an OAuth proxy sits on
  `mcp.vade-app.dev`, the author does not know whether it would
  interfere with the existing bearer-authenticated SSE stream
  used by Claude Desktop / Claude Code / iPad PWA. This needs
  verification in a staging setup before the recipient commits
  to the proxy path.
- **Library survey.** The author has not evaluated OAuth
  libraries for Node's built-in `http` server. Pick-a-lib vs
  hand-roll-minimum is part of the recipient's plan.
- **Consent UX assumption.** The "single-operator consent = one
  button" framing assumes Claude.ai's UI accepts a trivialized
  consent page. Unconfirmed.
- **Rate-limit / abuse surface.** The author has not modeled
  `/authorize` and `/token` against abuse on Fly ingress.
  Whatever endpoints ship need rate-limit shape baked in from
  day one.
- **Spec version drift.** The MCP authorization spec is
  evolving. Anchor the plan to a specific spec revision and
  note the commitment.
