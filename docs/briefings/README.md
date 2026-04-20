# Briefings

A **briefing** is a dated, signed document that captures one
agent's best framing of a problem so a different agent can pick
it up without access to the originating session's context.

Briefings live under `docs/briefings/` and are numbered in order
of creation.

> Procedure is being formalized in
> [#51](https://github.com/vade-app/vade-core/issues/51). Template
> and conventions below may evolve — check the tracking issue
> before writing a second briefing.

## Purpose

Agents working in scoped sessions — single repo, bounded context
window, narrow toolset — regularly surface problems whose real
scope exceeds what that session can address. The natural move is
to hand off to an agent with broader authority; in VADE that is
usually the COO, who has visibility across all five `vade-app`
repos.

A briefing is the written artifact of that handoff. It travels
with Ven, is read by the recipient, and stands on its own.

## Who writes these

Session-scoped agents. Typical author: a Claude Code session in a
cloud environment, with read/write access to one repo and none of
the surrounding context. The author is aware that:

- they are probably not the right authority to decide the plan;
- their framing of the problem is bounded by what they could see
  in one session;
- the receiving agent is expected to **re-examine** the problem
  and solution spaces, not just execute.

Briefings are not specifications. They are orientation.

## The natural-bounds caveat

A briefing reflects the author's best framing within their
session-scope. The recipient's job is to:

1. Read the briefing.
2. Re-examine the *true* problem space — including: is the problem
   as framed actually the right problem?
3. Re-examine the solution space — including: are the
   already-considered ideas the right frame, or is the author
   anchored?
4. Propose a plan that may diverge from the briefing's direction,
   with reasoning.

Every briefing carries a mandatory **Known bounds of this briefing**
section where the author names their own blind spots. That
section is the briefing's honesty gate; if it is missing or
generic, the briefing is not done.

## Lifecycle (draft)

- Draft briefing on a feature branch.
- Merged to `main` via the associated PR.
- Linked from the tracking issue or work item the recipient picks
  up.
- Marked resolved (or archived under `docs/briefings/archive/`)
  when the underlying task concludes.

This lifecycle is deliberately light. The full procedure lives in
the tracking issue.

## Template

Copy this block to start a new briefing.

~~~markdown
# Briefing: <short title>

**Date**: YYYY-MM-DD
**Author**: <one-line blurb — environment, device, role within the
project, and who brought the task. Example: "Claude Code session
(Opus 4.7, 1M ctx) in an Anthropic cloud env scoped to
`vade-app/vade-core`; session-scoped kernel agent; task brought
by Ven.">

## Who's who
- Principal: <who authorizes decisions>
- Author: <agent role + repo scope + what they cannot see>
- Recipient: <agent role + what they are being asked to do>

## What <subject> is (30 seconds)
<One paragraph of unavoidable background. Link to canonical docs
rather than duplicating them.>

## The problem
<What triggered the briefing. What doesn't work or is missing.>

## What's been decided directionally
<The author's current best framing of the solution. Labeled as
direction, not specification. Include trade-offs the author
already surfaced.>

## Your task
<The specific question(s) the recipient is being asked to answer
or the artifact they are being asked to produce. Include axes of
optimization.>

## Constraints
<Autonomy scope, repo boundaries, policy references, hard limits.>

## Read first
<Ordered list of canonical files/links that give the recipient the
same ground the author stood on.>

## Deliverable
<What comes back. Usually: a plan, not code.>

## Known bounds of this briefing
<Explicit: "I am scoped to X. I cannot see Y. My framing of the
problem may be wrong in these specific ways: ..." This section is
required — it is the briefing's honesty gate.>
~~~

The **Date + Author** header and **Known bounds** section are
both load-bearing. The header makes the briefing a dated, signed
artifact — the recipient (and anyone reading it months later) can
see which session wrote it, in which environment, at whose
request. The Known-bounds section forces the author to name their
blind spots.

## Examples

- [`001-session-token-plan.md`](./001-session-token-plan.md) —
  first briefing; handoff from a `vade-core`-scoped session to the
  COO for planning the Claude Code cloud-env bootstrap token scheme.
