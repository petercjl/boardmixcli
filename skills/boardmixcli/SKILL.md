---
name: boardmixcli
description: Operate Boardmix desktop boards through explicit atomic CLI commands for files, PNG images, object geometry and viewport. Use for authorized Boardmix automation; the caller owns content and layout decisions.
---

# BoardmixCLI capability manual

Input: explicit operations, Boardmix file keys, local PNG paths and object GUIDs, authorized by the user. Strategy: discover the installed contract, connect the selected editor, execute atomic operations and verify readback. Output: JSON receipts and verified Boardmix state. The calling Agent or application Skill owns business methods, material selection, ordering and layout.

## Main line

1. Resolve this Skill directory from the host's actual loaded resource path. Use Node.js with its target-owned `.runtime/bin/boardmixcli.mjs`; never infer a different Agent's installation path. Read this Skill’s `capabilities.json` and `adapters/generic.json` to resolve the logical execution and desktop features from the current host. Run `version`, `capabilities --json`, and `doctor --json`. In a source npm checkout, resolve the canonical runtime through the package CLI instead. Node.js >=22, local filesystem, loopback HTTP and authorized editor-console access are required. Any Agent with these capabilities may use the generic adapter. Native desktop execution is tested on macOS Boardmix 1.7.2; other desktop platforms remain unverified.
2. For local inspection, `image.list --directory ABSOLUTE_DIRECTORY` returns PNG filenames in natural numeric order; `image.inspect --file ABSOLUTE_PNG` returns source dimensions and SHA256. Caller decides whether this order suits the task. For editor actions, read the runtime's `CONTRACT.md` before the first write to obtain exact flags and response/error contracts.
3. Start `serve --session NEW_ABSOLUTE_PRIVATE_FILE`. Use the host's authorized native desktop tools to open the intended Boardmix editor's developer Console and execute the generated bootstrap script. This is an explicit provider adapter prerequisite: each opened editor requires its own connection. Close developer tools before file-close operations. Verify `status --session FILE` and `board.info --session FILE --file-key EXACT_KEY` identify the intended view. A mismatched front-end build stops for adapter repair.
4. Execute only caller-selected operations: file create/name/open/close; one PNG import; object get/move/resize; explicit viewport fit. Every editor command requires `--session` and `--file-key`. GUID sessionID/localID are separate numeric flags. Move uses absolute top-left board coordinates. Resize sets both dimensions and preserves aspect-ratio lock. Inspect each receipt, then read object/file state to verify the requested change before proceeding.
5. Report actual file identity, operations, verified state and unresolved outcomes. For close, verify the file is absent from the desktop's open-file tabs after the close receipt. Fit animates asynchronously, so an immediate viewport value may precede the final visual state.

## Recovery and boundaries

- Missing Node, desktop controls, console access, login or supported front-end build: return CAPABILITY_UNAVAILABLE / AUTH_REQUIRED / FEATURE_UNSUPPORTED with the prerequisite. Resume at step 1 or 3 after resolution; do not invent a different adapter.
- File create or image import timeout: outcome may be unknown. Inspect the operation receipt/outcome and actual file/object state before any new mutation. Avoid duplicate creates/imports. Resume at step 4 only when the outcome is known.
- Protected local destination: preserve unmanaged targets and edits; use CLI-managed skill status/install/update with the current Agent's explicit destination. Installation does not authorize Boardmix writes or paid service actions.
- Package update: read `.runtime/UPDATE.md`, reconcile only this selected installation, verify CLI/Skill/receipt versions and hashes, then refresh host discovery. A current verified receipt takes a read-only completion branch. Host discovery requires host evidence.
- New recurring integration failures belong in a separately authorized capability-package repair with tests. Business quality and layout rules remain owned by the application layer.

The runtime CONTRACT.md and capabilities.json are authoritative versioned operation references. This mechanical manual directly internalizes tested command behavior; it has no nested Skill or private knowledge-base dependency. Clean-context regression is separate from ordinary operation.
