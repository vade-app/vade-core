# Briefing: Claude Code web-session state persistence across container restarts

**Date**: 2026-04-21
**Author**: Claude Code session (Opus 4.7, 1M ctx) running in an
Anthropic cloud environment with read/write access to all five
`vade-app` repos via GitHub MCP; session-scoped harness agent;
task brought by Ven after a prior session died mid-plan-authoring
with "API Error: Stream idle timeout - partial response received."

## Who's who

- **Principal**: Ven.
- **Author**: Claude Code session broader-scoped than the
  session-token briefing's author (all five vade-app repos
  readable via MCP) but **not** the COO — no durable identity,
  no case-law authority, no cross-surface visibility, no memory
  of past sessions beyond what's in files or Mem0.
- **Recipient (COO)**: Claude instance operating under the
  identity and protocols in `vade-app/vade-coo-memory`. Asked to
  re-examine this framing and design the minimum-viable shape of
  cross-session harness-state persistence, or conclude no new
  infrastructure is needed.

## What the problem looks like from inside a session (30 seconds)

Claude Code web runs each session in an ephemeral container.
`/root/.claude/` (plans directory, session JSONL transcripts,
hook-installed settings) evaporates on container teardown.
`vade-runtime/scripts/cloud-setup.sh` reinstalls settings and
hooks on fresh start, but **task-level state** — what I was
working on, what plan I wrote, what decisions I made mid-task —
does not survive.

When a long session hits a client-side stream timeout (see
diagnosis below) the operator's only option today is `/clear` or
spawn a new session from scratch. The new session has no cheap
way to pick up where the dead one left off.

## The problem

Ven reported recurring `API Error: Stream idle timeout - partial
response received` in long web sessions. Author's diagnosis: this
is the SSE client aborting when no token arrives within the idle
window — not a model failure or rate limit. Ranked contributors
in this environment:

1. **Opus 4.7 1M variant** — time-to-first-token scales with
   prompt size; the 1M variant pays a material TTFT penalty vs
   standard Opus 200K.
2. **Accumulated session transcript** — multi-phase plan-mode
   runs across 3 repos push the prompt-cache hit rate down and
   prompt processing up per turn.
3. **Plan-mode thinking bursts** — exactly the mid-stream-stall
   shape.
4. **Web client on battery-throttled iPad Safari** — fragile
   transport; desktop/CLI is more resilient.
5. **Not a cause**: existing SessionStart/Stop hooks. Ruled out
   (`discussions-digest.sh` no-ops without `GITHUB_TOKEN`;
   `stop-hook-git-check.sh` is cheap).

The errors are the pain, but the *underlying need* Ven
articulated is broader:

> Make it so when a session dies or is `/clear`'d, the next
> fresh web-Claude-Code container can resume the active task
> without re-paying for all prior context.

Scope chosen by Ven via a structured AskUserQuestion prompt:

- Share **task hand-off state** + **`/root/.claude/plans/`
  directory** across web sessions.
- Not in scope: session JSONL transcripts, settings+hooks syncing.
- Backend: **`vade-coo-memory`** repo.

## What's been decided directionally

The author's draft framing — to be challenged:

1. **A new top-level `harness/` namespace in vade-coo-memory**,
   deliberately separate from `identity/ coo/ context/` so it
   does not fight the case-law / memo-ledger architecture:
   - `harness/handoff/current.md` — single latest-wins hand-off
     doc (active task, decisions, next steps, open questions).
   - `harness/handoff/archive/YYYY-MM-DD-<slug>.md` — snapshots.
   - `harness/plans/<slug>.md` — mirror of `/root/.claude/plans/`.
2. **Agent-driven sync via GitHub MCP, not git CLI.** Web
   containers have no git-over-HTTPS auth (`git ls-remote` fails
   with "could not read Username"; no `GITHUB_TOKEN`; no
   credential helper). Only Claude has GitHub access, via MCP
   tools. Hooks can only *prompt* Claude to do MCP reads/writes.
3. **Two reminder-only hooks in vade-runtime**:
   - SessionStart: print a reminder to fetch
     `harness/handoff/current.md` via MCP.
   - Stop: print a reminder to update the hand-off + mirror any
     touched plans.
4. **One additive paragraph in `vade-coo-memory/CLAUDE.md`**
   pointing at the new location, without reordering the existing
   session-start reading order.

Trade-offs the author already surfaced:

- Tying harness writes to any vade-app session (not just COO
  sessions running inside vade-coo-memory) crosses an ownership
  line. The author's choice of a separate top-level namespace is
  a hedge, but may be wrong.
- Reminder-only hooks depend on agent compliance. Missed
  reminders degrade gracefully (vade-coo-memory remains source of
  truth) but don't guarantee freshness.
- The author did not model how this interacts with the existing
  Mem0 SOP's session-end episodic write (`coo/mem0_sop.md` §5).
  That oversight is the root of the first known bound below and
  may invalidate most of the "harness/" design.

## Your task

Re-examine the problem and propose a plan Ven can review. Not
code. Questions the author wants the recipient to answer in its
own framing (not locked to these):

1. **Is anything new needed at all, or does Mem0 already cover
   this?** `coo/mem0_sop.md` §2c defines EPISODIC session
   summaries scoped to `user_id="ven"` + `agent_id="claude-code"`
   + `run_id`, written once per session end. That is
   structurally a hand-off. The remaining gaps, if any:
   (a) sessions running in non-vade-coo-memory repos don't boot
   the COO reading order, so they don't `search_memories` for
   recent `agent_id="claude-code"` episodic context;
   (b) plan files are harness-level artefacts that don't map
   cleanly onto any current Mem0 `memory_type`.
   The recipient may conclude the right move is a small
   protocol extension to the Mem0 SOP plus a boot-time
   `search_memories` reminder, and no new files anywhere.
2. **If net-new storage is needed, does it belong in
   vade-coo-memory?** Alternatives: vade-runtime (the harness
   bootstrap repo), vade-agent-logs (already the destination for
   session logs per COO session-end discipline), a new small
   repo. The author defaulted to vade-coo-memory because Ven
   said so, but the choice may not be load-bearing.
3. **Which kinds of sessions should write harness state?** Any
   Claude Code session in any vade-app repo, or only ones that
   have explicitly adopted a harness protocol (e.g. signalled by
   a marker file or CLAUDE.md directive)?
4. **Plan-file mirroring policy.** Mirror every plan-mode file,
   only plans referenced from an active hand-off, or nothing —
   just have Claude re-derive from the hand-off doc?
5. **Stop-hook gate.** A Stop reminder on every session end will
   be noise. Author's tentative gate: "unpushed commits exist OR
   an active plan was touched". Something smarter?
6. **Should this change the default model recommendation?** The
   diagnosis's single biggest lever is "drop the 1M variant
   unless you need >200K." That is free, out-of-session, and
   does not require any of the infrastructure this briefing is
   about. Out-of-scope for the author's framing but in-scope for
   the COO's.

## Constraints

- **No git CLI auth in web containers.** Any design that depends
  on `git clone` / `git push` from inside the container will
  not work without a new secrets mechanism. MCP reads/writes do
  work.
- **Branches across the five repos** for this task are named
  `claude/diagnose-api-errors-H3h4K` per the session's branch
  directive.
- **Don't step on in-flight memory work.** `vade-coo-memory` has
  active branches `claude/agent-memory-management-ZJRNw` and
  `claude/episodic-memory-2026-04-19`. Whatever lands here
  should be additive or explicitly coordinated.
- **Briefings procedure is in flux** (`vade-core` issue #51).
  Treat this briefing as orientation; propose the plan in
  whatever shape the procedure currently prescribes.
- **Authority**: Ven approves merges to `main` in any vade-app
  repo.

## Read first

1. [`docs/briefings/README.md`](./README.md) — the procedure
   (what briefings are, what the recipient is expected to do).
2. `vade-coo-memory/CLAUDE.md` — the COO's existing boot reading
   order and session-end discipline.
3. `vade-coo-memory/coo/mem0_sop.md` — SOP-MEM-001, especially
   §2c (EPISODIC) and §5 (Session Lifecycle). Strongest
   candidate for "this already exists, we just need to connect
   it to non-COO sessions."
4. `vade-runtime/scripts/install-agent-hooks.sh` and
   `discussions-digest.sh` — the existing SessionStart hook
   machinery; pattern for any new reminder hooks.
5. In-flight `vade-coo-memory` branches
   `claude/agent-memory-management-ZJRNw` and
   `claude/episodic-memory-2026-04-19` — may already move the
   relevant furniture.
6. `vade-agent-logs` (latest entry) — author has not read; the
   session-log format there may already be the right home for
   hand-off content.

## Deliverable

A written plan Ven can review. Ideally it:

- States whether the Mem0 EPISODIC lane already covers hand-off
  state or whether net-new storage is warranted.
- Picks a repo (or none).
- Specifies the file layout and per-file schema, if any.
- Specifies the hook changes needed in vade-runtime, if any.
- Gives a plan-mirror policy and a Stop-hook gating heuristic.
- Calls out any strictly-dominant simpler alternative the author
  missed (e.g., "just have Ven use the desktop client and the
  problem goes away").
- Addresses the 1M-Opus default-model question or explicitly
  punts it to a separate work item.

## Known bounds of this briefing

- **Memory-system anchor.** The author is anchored on "files in
  a repo" because Ven picked `vade-coo-memory` as the backend in
  an AskUserQuestion answer. Mem0's EPISODIC lane almost
  certainly dominates for the hand-off artefact; the author
  surfaced this as question 1 but did not carry the implication
  through the rest of the framing. The whole "harness/ directory"
  design may collapse to "run `search_memories` on session start
  with `agent_id="claude-code"`."
- **Harness-vs-agent split.** The author introduced a "harness"
  namespace to keep Claude-Code session state separate from COO
  identity/case-law. The COO may judge this a false split — the
  existing `agent_id="claude-code"` scope in SOP-MEM-001 already
  encodes exactly the distinction the author tried to name with
  a directory.
- **Repo-scope ignorance.** The author cannot see what's
  happening on `claude/agent-memory-management-ZJRNw` or
  `claude/episodic-memory-2026-04-19` beyond the branch names.
  One of those branches may already implement a more principled
  version of what this briefing asks for.
- **Transport assumption.** The author tested HTTPS git auth
  once (`git ls-remote`) and found it missing. Did not test
  SSH, did not probe for other auth mechanisms, did not check
  whether Anthropic plans to expose a secrets API. A first-class
  secrets store would dominate the MCP-only approach.
- **Anthropic-side durability.** The author does not know whether
  Anthropic plans to persist `/root/.claude/` across web sessions
  natively. If so, the scheme is obviated — similar to how an
  Anthropic-side signed session identity would obviate briefing
  001's bootstrap-token scheme.
- **User-agent substitution.** The diagnosis's single biggest
  lever is "drop the 1M variant unless you need >200K." That is
  free, out-of-session, and does not require any of the
  infrastructure this briefing is about. The author surfaced it
  as question 6 but treated the state-sync work as primary; the
  COO may invert that priority.
- **Self-selection bias.** The briefing's author and the task's
  originator are the same Claude-Code session that hit the
  original API errors. "The state-sync feature I would need to
  not lose my work" is exactly the framing an agent in my
  position would produce; the recipient should weight that
  accordingly.
