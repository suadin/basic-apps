# Release notes

## 0.1.0 — 2026-10-29

- First version. The page shows the folder tree of the workspace, the projects under
  `repos/` and the drift between descriptions and disk.
- `tools/scan.py` writes `site/state.json` from the filesystem and refuses to write
  when the document would contain an address, a volume path, a key or a token.
- `descriptions.json` holds the prose per folder and per project; a missing entry is
  drift, not an empty card.
- Deviation from `BASIC-DATA-01`: the inventory is real data about this machine and is
  published on purpose. The scanner is the guard. Review 2027-01-29.
