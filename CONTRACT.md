# Capability contract

The CLI executes explicit operations. The calling Agent or application Skill owns content, file choice, sorting, coordinates, layout and acceptance decisions. The desktop/web adapter owns provider integration and translates native coordinate and ratio-lock behavior.

## Commands

Every connected command requires `--session PATH --file-key KEY`. `KEY` is the connected source context; a new target must be opened and attached before operating on it. Results are JSON. Failed commands exit nonzero. Successful native mutations include readback when available.

| Command | Additional input | Result / side effect |
| --- | --- | --- |
| `board.info` | none | File name, team/project/folder, upload and connection status |
| `board.create` | `--team-id N --project-id N [--folder-id N]` | Creates one unnamed file; returns its key; opens separately |
| `board.rename` | `--name TEXT` | Changes name and reads it back from the service |
| `board.open` | `--target-file-key KEY` | Requests a desktop tab; attachment and UI verification follow |
| `board.close` | none | Rejects pending uploads, pending local save or disconnected cloud sync; returns close request receipt |
| `image.list` | `--directory PATH` only | PNG metadata inventory in natural filename order; no connection needed |
| `image.inspect` | `--file PATH` only | PNG dimensions, size and SHA-256; no connection needed |
| `image.import` | `--file PATH` | Imports one PNG through the application uploader; returns asset digest, resource hash, new GUID and actual geometry |
| `object.selection` | none | Returns currently selected objects; no selection change |
| `object.get` | `--session-id N --local-id N` | Reads one object |
| `object.move` | GUID plus `--x N --y N` | Absolute **top-left board coordinates**; translates native center-point API and verifies |
| `object.resize` | GUID plus `--width N --height N` | Exact target size; temporarily releases ratio lock, restores it and verifies |
| `view.fit` | `--ids JSON_GUID_ARRAY` | Fits only explicit GUIDs into the viewport |

Image import preserves source bytes. Boardmix may choose a smaller initial display size; explicit resizing is a separate caller decision. Resizing does not resample or replace the uploaded source image.

## Transport and recovery

`serve --session NEW_PATH` creates a loopback service, private session token and console bootstrap script. For a CDP-connected Chrome, `browser.connect` attaches each exact editor without opening DevTools. Desktop console attachment remains a fallback. Close the developer-tools window after attachment before executing operations. On desktop 1.7.2 an open developer-tools window prevented the native close request from removing the tab in one test; repeating with developer tools closed removed the tab and passed UI verification. The source file path never goes to Boardmix: only the selected file bytes and base name enter the application's normal uploader. The local service exposes only explicitly registered image digests under authenticated routes.

Each request targets one file key, carries a correlation ID and is dispatched once. The bridge routes to the matching attached view. Do not automatically retry file creation or image import after timeout. Inspect the canvas and request outcome first. In-memory outcomes are available at authenticated `/outcome/ID`; durable operation receipts are the caller's responsibility in this prototype.

The browser adapter currently validates the observed `index-DjSD2oPg.js` build. An unverified build fails explicitly. Readback error is a mutation outcome requiring inspection, not proof that no change happened. `board.close` acknowledges a close request; the calling Agent verifies that the tab actually disappeared. Cloud-save persistence is verified by reopening and reading objects, independently of the close receipt. Native `view.fit` animates asynchronously; its immediate viewport snapshot can precede the final settled view. The calling Agent confirms the displayed fit independently.

## Added capability operations

`frame.create --session FILE --file-key KEY --x X --y Y --width W --height H --name TEXT` creates one native Frame, normalizes its top-left position, sets and verifies its name.

`text.create` uses the same geometry options with `--text TEXT [--font-size N]` (default 28). Native text uses auto-fit bounds; returned width and height are actual measured values, not a fixed requested rectangle. Verify position and inspect visible content; current text readback exposes font size, not the rich-text content.

`image.download --url URL --output NEW_FILE` downloads only the explicit HTTP(S) source, validates PNG/JPEG/WebP metadata and creates a private new file with SHA256. Existing targets refuse overwrite. `image.inspect`, `image.list` and `image.import` accept the same formats and preserve source bytes. Download failure does not submit anything to Boardmix.

Frame/text creation has the same uncertain-outcome rules as image import. Geometric containment inside Frames is distinct from native parent-child membership; the latter is not exposed by this contract.

## Distribution status

npm-distributed capability package with CLI-managed isolated Skill installation. Source changes beyond the registry version require an explicitly selected development entry until their release. Any Agent with Node.js, filesystem access and an authorized Boardmix connection can call the CLI. This machine's macOS desktop runtime has been exercised; other systems remain unverified. Application-layer Skills will be authored separately.

## Batch operations (contract version 1)

- `image.inspect.batch --input FILE`: JSON array of 1–1000 absolute file paths; returns `images` with dimensions, SHA256 and MD5. Local inspection uses bounded concurrency.
- `image.import.batch --session SESSION --file-key KEY --input FILE --receipt NEW_FILE`: JSON array of 1–20 `{key,file,sha256?}` entries. Imports through one native uploader call; returns `items` containing the caller key, source metadata and distinct object GUID, plus `uploadFinished`. Native resource hashes are matched to source MD5, independently of completion order. Duplicate bytes receive distinct GUIDs.
- `object.get.batch --session SESSION --file-key KEY --input FILE`: JSON array of 1–1000 `{sessionID,localID}` values; returns `objects` in input order.
- `object.place.batch --session SESSION --file-key KEY --input FILE`: JSON array of 1–200 `{sessionID,localID,x,y,width,height}` entries. Validates the whole request, then applies exact dimensions and absolute top-left positions, restores original aspect locks and waits for matching readback. Returns `objects` in input order. It is not a transactional rollback operation: failure can leave partial placement; inspect and repeat explicit placement for the same GUIDs.

Import receipts are private, durable files reserved before submission. Reusing the same input, file key and receipt reads the recorded result or the running bridge outcome; it never submits the import again. Changed inputs return RECEIPT_CONFLICT. BATCH_OUTCOME_UNRESOLVED requires inspection of the existing operation and canvas; retain the receipt, source files and session, and do not create a fresh receipt to retry an uncertain import. Bridge outcomes are in memory; a completed receipt survives bridge restarts. Batch writes on one editor are serialized, while local file reads and native upload scheduling can run concurrently.

Frame creation can return rounded native dimensions. Callers requiring exact fractional geometry apply `object.place.batch` or `object.resize` using the returned GUID. Preserve the GUID before validating final layout so recovery can finish placement without recreating the Frame.

## Browser connection (contract version 1)

The caller supplies an existing, authorized Chrome CDP endpoint as `--endpoint http://127.0.0.1:PORT`. No browser profile is created and no login is copied. Only Boardmix app targets are enumerated. This route does not launch or restart the desktop app. A normal desktop without a CDP endpoint retains the explicit console fallback; a failed browser connection must not silently switch hosts.

- `browser.targets --endpoint URL`: read-only target inventory with title, URL, exact file key and target ID.
- `browser.open --endpoint URL --file-key KEY`: opens an existing Boardmix file in a browser tab, or reuses its unique existing tab. Requires an existing Boardmix app/home tab. It does not create a Boardmix file. Call `board.create` separately through a connected editor.
- `browser.connect --endpoint URL --session SESSION --file-key KEY`: matches one exact editor, waits for its app script, injects the versioned adapter and verifies the authenticated local bridge. Reuses only a live adapter matching that session; pending writes refuse replacement. Returns connected/reused/fileKey/visibleDevTools. No visible console is opened.
- `browser.close --endpoint URL --session SESSION --file-key KEY`: reads upload/save/sync status first, closes only the exact tab and checks that its target disappears. It preserves the cloud file. BROWSER_CLOSE_PENDING requires target inspection rather than a blind repeated close.

Missing endpoint/target, duplicate matching tabs, unverified adapter build and identity mismatch stop with structured errors. Login remains the user's existing browser session. Editor writes still require an explicit file key and the existing capability authorization. Source and CDN image bytes follow the same upload contract as desktop mode. Browser attachment has been tested on macOS Chrome; native Windows/Linux execution remains unverified.

## Managed browser and login

`browser.ensure --json` starts/reuses macOS Google Chrome at http://127.0.0.1:9223 using the persistent `~/.dianshang-chrome-profile`, opens Boardmix home if absent, and returns `state:ready` only after workspace login markers are visible. No pre-opened Boardmix tab is required. The packaged launcher has no ecommerce CLI dependency.

`auth.status --json` is read-only. `auth.wait --wait-ms 60000 --json` resumes preparation and polls login for up to 60 seconds; `browser.ensure` defaults to 15 seconds and returns immediately on an identified login page. AUTH_REQUIRED includes a human login prompt and resume command. Unknown/load states remain AUTH_STATE_UNKNOWN. CLI exits nonzero until ready. Human login/verification stays in Chrome; the CLI does not read or print credentials. Repeat calls reuse the profile and home tab.

Startup verifies the listening process, Chrome executable, debugging port and exact profile. PORT_CONFLICT refuses to change other processes. Missing Chrome and unsupported launch platforms are explicit errors. Windows/Linux launch is not implemented. Existing explicit-endpoint browser commands remain compatible. Browser readiness does not grant file write authorization; continue with the caller-selected file and bridge session.

## Native video contract v1

`video.inspect --file FILE` returns MP4 width, height, duration, SHA256 and MD5 using ffprobe on PATH. `video.download --url HTTPS_URL --output NEW_FILE` preserves source bytes and refuses existing files. Maximum source size is 100 MiB.

`video.import --session SESSION --file-key KEY --file FILE --receipt NEW_RECEIPT` creates one native video object, awaits the provider upload, and verifies object resourceHash equals source MD5, mediaType is video/mp4, and mediaLoading is false. Returns asset, object GUID/geometry, and uploadFinished. Placement is a separate explicit operation. The receipt is reserved before submission. Repeating the same file hash and board with the same receipt retrieves the known result; changed intent returns RECEIPT_CONFLICT, unknown outcome returns VIDEO_OUTCOME_UNRESOLVED without resubmission. Use object.get after recovery to verify the object still exists. No automatic transcoding or poster substitution. Tested on macOS Chrome; other hosts require ffprobe and runtime verification.
