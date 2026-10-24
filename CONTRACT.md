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

`serve --session NEW_PATH` creates a loopback service, private session token and console bootstrap script. Bootstrap attachment is currently performed once per opened view by an Agent. Close the developer-tools window after attachment before executing operations. On desktop 1.7.2 an open developer-tools window prevented the native close request from removing the tab in one test; repeating with developer tools closed removed the tab and passed UI verification. The source file path never goes to Boardmix: only the selected file bytes and base name enter the application's normal uploader. The local service exposes only explicitly registered image digests under authenticated routes.

Each request targets one file key, carries a correlation ID and is dispatched once. The bridge routes to the matching attached view. Do not automatically retry file creation or image import after timeout. Inspect the canvas and request outcome first. In-memory outcomes are available at authenticated `/outcome/ID`; durable operation receipts are the caller's responsibility in this prototype.

The browser adapter currently validates the observed `index-DjSD2oPg.js` build. An unverified build fails explicitly. Readback error is a mutation outcome requiring inspection, not proof that no change happened. `board.close` acknowledges a close request; the calling Agent verifies that the tab actually disappeared. Cloud-save persistence is verified by reopening and reading objects, independently of the close receipt. Native `view.fit` animates asynchronously; its immediate viewport snapshot can precede the final settled view. The calling Agent confirms the displayed fit independently.

## Distribution status

Local development prototype. No publication or managed CLI/Skill installation is claimed. Any Agent with Node.js, filesystem access and an authorized Boardmix connection can call the CLI. This machine's macOS desktop runtime has been exercised; other systems remain unverified. Application-layer Skills will be authored separately.
