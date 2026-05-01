<!--
  Issue / PR hygiene checklist (Patterns A–D from
  vade-app/vade-coo-memory: coo/operations/issue-pr-hygiene.md).
  The hygiene workflow validates this body on PR open/sync.
  Pattern B is ADVISORY in this repo (rollout phase); A/C/D advisory.

  Delete this comment block before submitting if you'd like cleaner UX.
-->

## Summary

<!-- 1-3 bullets: what this PR changes and why. -->

## Closing keywords

<!-- One of:
       Closes #N                           (same-repo issue)
       Closes vade-app/<repo>#N            (cross-repo issue)
       Closes: n/a                         (no issue resolved)

     NEVER use `Closes <reponame>#N` (no `vade-app/` prefix) — it
     autolinks but does NOT auto-close. See
     vade-app/vade-coo-memory: coo/operations/issue-pr-hygiene.md.
-->

Closes:

## Cross-repo references

<!-- Use full form `vade-app/<repo>#N` for any reference outside this repo.
     For lists, repeat the prefix per item:

       vade-app/vade-coo-memory#29, vade-app/vade-coo-memory#64

     NOT:

       vade-app/vade-coo-memory#29, #64       (← #64 autolinks to vade-core#64)
-->

## Notation reminder

<!-- Non-issue IDs use dash form (no `#`):

       quorum-1, instance-N, briefing-014, MEMO-2026-04-26-02

     NEVER `quorum #1` / `instance #N` / `briefing #14` — these autolink
     to unrelated GitHub issues.
-->

## Test plan

<!-- How to verify this PR end-to-end. Bulleted checklist. -->
