<!--
  Issue / PR hygiene checklist (Patterns A–D from coo/operations/issue-pr-hygiene.md).
  The hygiene workflow validates this body on PR open/sync. Pattern B (closing
  keywords) is advisory in this repo (BLOCKING in vade-coo-memory only,
  pending betterment-cadence promotion per briefing-014); A/C/D are advisory.

  Delete this comment block before submitting if you'd like cleaner UX.
-->

## Summary

<!-- 1-3 bullets: what this PR changes and why. -->

## Closing keywords

<!-- One of:
       Closes #N                           (same-repo issue)
       Closes vade-app/<repo>#N            (cross-repo issue)
       Closes: n/a                         (no issue resolved)

     NEVER use `Closes vade-coo-memory#N` (no `vade-app/` prefix) — it
     autolinks but does NOT auto-close. See coo/operations/issue-pr-hygiene.md.

     For multiple issues, ONE `Closes` LINE PER ISSUE — comma-lists
     silently fail (only the first ref auto-closes):

       Closes vade-app/vade-coo-memory#393   ← all three auto-close
       Closes vade-app/vade-coo-memory#394
       Closes vade-app/vade-coo-memory#395

       Closes #393, #394, #395               ← only #393 closes;
                                               #394 + #395 stay open.
-->

Closes:

## Cross-repo references

<!-- Use full form `vade-app/<repo>#N` for any reference outside this repo.
     For lists, repeat the prefix per item:

       vade-app/vade-runtime#29, vade-app/vade-runtime#64

     NOT:

       vade-app/vade-runtime#29, #64       (← #64 autolinks to coo-memory#64)
-->

## Notation reminder

<!-- Non-issue IDs use dash form (no `#`):

       quorum-1, instance-N, briefing-014, MEMO-2026-04-26-02

     NEVER `quorum #1` / `instance #N` / `briefing #14` — these autolink
     to unrelated GitHub issues. Repo autolinks render the dash form as
     click-through links to canonical doc paths.
-->

## Test plan

<!-- How to verify this PR end-to-end. Bulleted checklist. -->
