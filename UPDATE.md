# Update for the current Agent

Send to your current Agent:

> 更新 @petercjl/boardmixcli，并验证当前 Agent 的配套 Skill 已同步。

Resolve the selected Agent's exact Skill destination before replacement. Run `skill status` and preserve local edits; unmanaged targets refuse reconciliation. `update check --json` checks the stable registry version. `update install --agent YOUR-VALID-AGENT-NAME --destination ABSOLUTE-SKILL-DIRECTORY --yes --json` downloads a candidate with real npm into a private temporary prefix, synchronizes only the selected target, verifies hashes and returns its target-owned runtime entry. This managed update does not replace an unrelated global npm installation. Use the returned entry as the current installation, or explicitly upgrade the global npm CLI and repeat selected-target synchronization when a global entry is required.

Every package upgrade requires Skill synchronization, including same-version missing/stale repair. A verified current target takes a read-only no-op branch. Existing managed targets receive a recoverable adjacent backup before replacement. Host UI metadata is preserved. Missing canonical files may be repaired; edited files require reconciliation by the user. Package download failure leaves the target unchanged. A synchronization failure reports its phase and recovery; retry against the same target after resolving it. Backups provide rollback by restoring the preserved directory after checking ownership. Refresh host discovery and verify CLI version, Skill manifest/receipt version and `skill status` hashes. Host registration remains a separate host-owned phase.

Ordinary atomic task entry checks for updates with a 1200 ms network timeout, persistent 24-hour throttling including offline backoff, and notification only. Set `BOARDMIXCLI_UPDATE_CHECK=0` to disable detection or `BOARDMIXCLI_CACHE_DIR` to choose a cache directory. Automatic installation requires an explicit update request. No other Agent is synchronized.
