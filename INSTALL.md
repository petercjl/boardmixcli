# Install for the current Agent

Send to your current Agent:

> 安装 @petercjl/boardmixcli，并验证当前 Agent 的配套 Skill 可用。

Agent execution contract: install the npm CLI, inspect `boardmixcli capabilities --json` and `boardmixcli skill source --json`, resolve your own advertised/configured Skill discovery directory, and pass the exact new Skill directory to `boardmixcli skill install --agent YOUR-VALID-AGENT-NAME --destination ABSOLUTE-SKILL-DIRECTORY --json`. Any valid Agent name uses the generic adapter. A missing destination stops before mutation. Unmanaged targets and local edits are protected. This step copies all resources and an isolated `.runtime` into the selected target. Installation does not access Boardmix or modify another Agent.

Verify `skill status` using the same target and Agent: installed, managed, current and verification.verified must be true. Execute the target-owned `.runtime/bin/boardmixcli.mjs` with Node.js and verify its version. Load SKILL.md through your host's native registration/discovery mechanism; refresh the host session when necessary. The CLI reports host discovery pending because it cannot verify the host catalog. Report completion only when the host actually discovers/loads the Skill. Otherwise report the pending phase and recovery action.

With npm scripts disabled, follow this identical handoff explicitly; the postinstall notice is guidance, not configuration. If npm succeeds but Skill sync fails, keep the installed CLI, resolve ownership/destination and retry `skill install/update`. Credentials remain in the already logged-in Boardmix application. Node.js >=22 and authorized per-editor developer-console access are external prerequisites. Desktop automation is tested on macOS Boardmix 1.7.2; other desktop platforms are unverified.
