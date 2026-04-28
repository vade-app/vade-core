# Vendored skills — upstream tracking

Skills under this directory whose source is an upstream repo. Track the SHA
they were copied from so a bump is a deliberate, reviewed action — not a
silent rolling-`main` drift.

## cf-wrangler, cf-workers-best-practices

- **Source repo**: https://github.com/cloudflare/skills (Apache-2.0)
- **Source commit**: `7c449def4e0c63daa27212d853094e4c8e37bbe8` (2026-04-27,
  "Add Flagship (feature flags) skill reference (#47)")
- **Snapshot date**: 2026-04-28
- **Source paths**:
  - `skills/wrangler/SKILL.md` → `cf-wrangler/SKILL.md`
  - `skills/workers-best-practices/{SKILL.md,references/*}` →
    `cf-workers-best-practices/{SKILL.md,references/*}`
- **Local edits**: only the `name:` field in each `SKILL.md` frontmatter,
  changed from `wrangler` / `workers-best-practices` to the namespaced
  `cf-wrangler` / `cf-workers-best-practices`. This avoids shadowing
  collisions in our skill aggregator (vade-runtime/scripts/lib/common.sh
  `aggregate_workspace_claude_config`, first-source-wins).
- **Why we did NOT install via plugin marketplace**: the marketplace plugin
  bundles `.mcp.json` with five Cloudflare-hosted MCP servers, which would
  silently mutate our MCP topology — a boot-impacting change per
  MEMO-2026-04-25-03. Vendoring lets us pick exactly two skills and pin a SHA.

## Bump procedure

1. `git clone --depth 1 https://github.com/cloudflare/skills.git /tmp/cf-skills`
2. Diff each vendored path against the new `main` SHA:
   `diff -ru /tmp/cf-skills/skills/wrangler cf-wrangler` (expect only
   the `name:` line to differ)
3. Apply upstream changes with the `name:` rename preserved.
4. Update the source-commit SHA + snapshot date above.
5. Commit with message `chore(skills): bump cloudflare/skills to <new-sha>`.

## Skills not vendored (yet)

- `cloudflare` — broad catch-all; deferred until trigger frequency is
  measured.
- `agents-sdk` — Cloudflare Agents primitive is Durable-Object-backed;
  vade-core's "agent" abstraction is unrelated. Misfit.
- `durable-objects` — only relevant once we add a DO.
- `sandbox-sdk`, `cloudflare-email-service`, `web-perf` — not in scope.
