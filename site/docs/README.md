# basic-apps

The public state of this workspace: which folders exist, what each one is for, and
where the projects stand. It follows [Basic Specs](https://github.com/suadin/basic-specs).

The page shows an **inventory, never content**. Folder and project names, counts, app
versions, pinned standard versions, deviations, last commit dates and the drift between
description and disk. No addresses, no paths inside the closed folders, no tokens.

## Two directions, one truth

```sh
python3 tools/scan.py            # reads ~/dev, writes site/state.json
python3 tools/scan.py --check    # validates the committed file, no workspace needed
```

Only the first can be current, because only this machine has the folders. The second is
what CI runs: it proves the shape and the absence of sensitive text, not the contents.

`tools/scan.py` refuses to write when the document would contain an address, a volume
path, an ssh key path, a private key or a token. `secrets/` and `backups/` appear as
existence only — their contents and even their file names are never read.

Drift is a failure, not a warning: a folder on disk without a description, a
description without a folder, a repository that `bootstrap/repos.txt` would not clone
(unless it is marked `localOnly`), or one that is marked `localOnly` and is in the
registry anyway.

## Local setup

Needs Python 3 and Node 22.

```sh
pnpm install
python3 tools/scan.py
python3 -m http.server 4173 --directory site
```

Open <http://127.0.0.1:4173/>.

```sh
pnpm check
```

`pnpm check` runs the Basic Specs check with its declared commands, the unit suites
(Node and Python), the metrics, the documentation drift check and the state check.

## What to edit

- `descriptions.json` — the prose per folder and per project. This is the file a human
  edits; everything else is generated or fixed.
- `site/index.html`, `site/app.js`, `site/logic.js`, `site/style.css` — the page.
- `tools/scan.py` and `test/test_scan.py` — the scanner and its guard.
- `docs/APP-SPECS.md`, `README.md`, `RELEASE-NOTES.md` — the documents.

Do not edit `docs/BASIC-SPECS.md` or `basics/`: both are generated from the pinned
standard. Change `basics.json` instead and run `pnpm basics docs`.

## What this page cannot know

- Whether an origin exists on GitHub. It reads the local git configuration: `set` means
  a remote is configured, not that the repository answers.
- Whether anything was deployed.
- Anything inside `secrets/` or `backups/`.

## Tests

`pnpm test` runs the Node suite and the scanner suite. `pnpm test:e2e` runs the
Playwright journeys against `site/`. `pnpm metrics` runs both and writes
`site/test-metrics.json`, which the footer reads; a missing run is shown as
`not executed`, never as zero.

## Deployment

`./publish.sh` copies the source documents into `site/docs` and checks that
`site/state.json` exists. The workflow deploys `site/` on every push to `main`.

**A deploy is only as true as the last local scan.** CI cannot read this machine; it
validates the committed file. Whoever changes a folder edits `descriptions.json` and
runs the scan, otherwise the page keeps its old state and the next `--check` fails on
drift only after someone re-runs it.

## Licence

MIT.
