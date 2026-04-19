# Branch Purpose: claude/discussion-update-log-counter

This branch is a **permanent test fixture** that will never be merged to `main`.

## Purpose

This branch exists to test and demonstrate the scheduled automation system that
triggers Claude Code sessions on PR updates with the `Discussion-update` label.

## What it does

1. Maintains a log counter in `TRIGGER_LOG.md` that tracks each trigger
2. Serves as a live PR to `main` with the `Discussion-update` label
3. Demonstrates the automation workflow for discussion-based PR updates

## Maintenance

- This branch should remain open as a PR indefinitely
- The trigger log should be updated each time the automation runs
- Do not merge this branch to `main`

## Automation Trigger

The scheduled automation watches for PRs with the `Discussion-update` label
and triggers code sessions to handle updates, track metrics, or perform
automated tasks on those PRs.
