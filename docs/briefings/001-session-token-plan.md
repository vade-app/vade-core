# Briefing: vade-core session-token minting plan

**Date**: 2026-04-20
**Author**: Claude Code session (Opus 4.7, 1M ctx) running in an
Anthropic cloud environment scoped to `vade-app/vade-core`;
session-scoped kernel agent; task brought by Ven.

## Who's who
- **Principal**: Ven (operator, BDFL for VADE).
- **Author**: Claude Code session scoped to `vade-app/vade-core`
  only. Cannot read or write other vade-app repos from here.
- **Recipient (COO)**: Claude instance with wider GitHub access
  and all five vade-app repos cloned locally. Asked to design the
  **minimum-viable** version of the scheme below, optimizing for
  fast cloud-env boot and small surface area.

## What VADE is (30 seconds)

`vade-core` is the VADE kernel — a tldraw-based canvas IDE served
from Cloudflare Workers at `vade-app.dev`, plus a hosted MCP
server at `mcp.vade-app.dev` (Fly.io app `vade-mcp`). Canvas ↔ MCP
WSS bridge + MCP SSE transport. Single-operator bearer-token auth
gates everything client-facing. See
[`docs/auth.md`](../auth.md) and
[`docs/mcp-connector.md`](../mcp-connector.md) for the full picture.

## The problem

Claude Code runs on the web in "cloud environments." Each env has:

- An `.env`-format **Environment variables** box explicitly
  labeled "visible to anyone using this environment — don't add
  secrets."
- A **Setup script** that runs before Claude Code launches.
- **No** secrets manager, **no** ambient identity (no
  `GITHUB_TOKEN`, no `gh` CLI, no `~/.netrc`, no cloud IAM). The
  GitHub MCP tools work but via Anthropic's internal channel —
  not surfaced as a shell-usable credential.

The hosted MCP server requires
`Authorization: Bearer <operator-token>`. Pasting the operator
token into the visible env-vars box would expose it in plaintext
to anyone with access to the env. We need a safer path.

## What's been decided directionally

Direction chosen (not specification): **scoped bootstrap token +
token-minting endpoint on the Fly MCP service.**

1. Add `POST /session-token` on `vade-mcp` (Fly). Gated by a new
   `VADE_SESSION_BOOTSTRAP_TOKEN` Fly secret.
2. Endpoint mints a short-TTL operator token (target 24h, under
   discussion), appends to `VADE_AUTH_TOKENS.operator`, logs
   every issuance with a session id.
3. `VADE_SESSION_BOOTSTRAP_TOKEN=<value>` goes in the Claude Code
   cloud env's visible env-vars box — accepted trade-off because
   (a) its only capability is minting short-lived tokens,
   (b) it can be rotated without touching iPad/desktop operator
   tokens, (c) leaked minted tokens age out on their own.
4. The cloud-env setup script calls `/session-token`, exports the
   returned token as `VADE_AUTH_TOKEN` for the session. `.mcp.json`
   already interpolates `${VADE_AUTH_TOKEN}` into the SSE
   `Authorization` header.

Trade-offs already surfaced by the author:

- This isn't cryptography — it's TTL + separation of duties.
  Bootstrap token compromise lets an attacker mint tokens until
  it's rotated, but blast radius is bounded and the operator
  token itself never touches the cloud env.
- If Anthropic publishes cloud-env egress IP ranges, the
  bootstrap could also require source-IP match for defense in
  depth. Author does not know whether those ranges are stable
  or published.

## Your task

Plan the **minimum version** of this that lets a fresh Claude
Code cloud env boot with a working `vade-canvas` MCP connection,
optimizing two axes:

1. **Boot time** — today's setup script clones `vade-runtime`
   shallowly and runs `cloud-setup.sh`. The minimum cloud env
   need not include all five repos; identify what's actually
   required on the critical path to `claude` launch and cut the
   rest.
2. **Surface exposure** — the smaller the bootstrap token's
   capability, the better. Consider: issuance rate limits,
   IP-narrowing if Anthropic publishes cloud-env egress ranges,
   whether the minted token should be capability-restricted vs
   full operator, audit log shape, revocation path.

## Constraints

- `vade-core` is the only repo under the current session's
  autonomy (per `vade-core/CLAUDE.md`). Endpoint code goes in
  `vade-core/mcp/`. Deploy via existing `.github/workflows/mcp-deploy.yml`
  on merge to `main`.
- `cloud-setup.sh` lives in `vade-runtime` — your side. Keep it
  dependency-light; it runs on every cold session start.
- Auth policy and threat model live in `docs/auth.md` — any
  surface-area changes should update it in the same PR.
- Ven approves merges to `main` in any vade-app repo.

## Read first

1. [`CLAUDE.md`](../../CLAUDE.md) — repo scope, tech stack,
   conventions.
2. [`docs/auth.md`](../auth.md) — token model, rotation, threat
   model.
3. [`docs/mcp-connector.md`](../mcp-connector.md) — client setup
   for Claude.ai / Desktop / Code.
4. `mcp/auth.ts` and `mcp/index.ts` — where `/session-token`
   would attach.
5. `vade-runtime/scripts/cloud-setup.sh` — current boot surface
   (in your clone, not available from the author's session).

## Deliverable

A written plan Ven can review: endpoint spec, setup-script diff
sketch, rotation cadence, and a staged rollout (feature-flagged
if useful). No code yet — plan first.

## Known bounds of this briefing

The author is aware of the following bounds on this framing and
expects the recipient to challenge them:

- **Repo visibility**: the author can only read `vade-core`.
  `vade-runtime`, `vade-governance`, `vade-coo-memory`, and the
  fifth `vade-app` repo are invisible. Any assumption about what
  `cloud-setup.sh` currently does is inferred, not verified.
- **Cloud-env capabilities**: the author does not know whether
  the Claude Code web environment has (or will soon have) a
  first-class secrets API. If it does, the entire minting scheme
  may be unnecessary; the bootstrap becomes a stored secret.
- **Anthropic-side identity**: the author does not know whether
  Anthropic publishes (or plans to publish) signed session
  identity for cloud envs (e.g., OIDC-style claims). A signed
  identity would let the Fly endpoint validate the caller
  without a bootstrap token at all — strictly better.
- **Network-level gating**: the author does not know Anthropic's
  cloud-env egress IP ranges. If stable, a firewall allowlist on
  the Fly side would dominate any token-based scheme for this
  use case.
- **Framing anchor**: the author may be anchored on "bearer
  token + mint endpoint." The problem may admit cleaner shapes
  (mTLS, signed request headers, short-lived JWTs derived from
  Anthropic identity) that the author did not enumerate.
- **Abuse surface**: the author has not surveyed rate-limit /
  abuse patterns on Fly ingress. The endpoint spec should factor
  that in even if the bootstrap token is held tightly.
- **"Minimum version"**: the author does not know which of the
  five vade-app repos are actually on the critical path for
  Claude Code cloud-env boot. The boot-time axis of the task
  depends on that mapping, which is entirely on the recipient's
  side.
