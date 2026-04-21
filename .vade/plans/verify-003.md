# Verify briefing 003 session-lifecycle hooks

End-to-end verification of vade-runtime PR #10.

- Confirm SessionStart prints the SOP-MEM-001 reminder with a suggested run_id.
- Run `search_memories` for `user_id=ven, agent_id=claude-code`; note newest run_id and artifact_refs.
- Commit this plan to `vade-core/.vade/plans/verify-003.md` on `claude/verify-briefing-003` and record SHA.
- Write one `session_summary` episodic Mem0 entry with `artifact_refs` to that commit.
