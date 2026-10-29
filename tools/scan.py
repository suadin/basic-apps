"""Scan the workspace and write the public state document.

The page at `site/` shows what this machine's workspace contains: which folders
exist, what each one is for, which projects live under `repos/` and where they
stand. It never shows content — no addresses, no paths inside the closed
folders, no tokens.

Two ways to be right:

- `python3 tools/scan.py` reads the workspace and writes `site/state.json`.
  Only this direction can be true, because only this machine has the folders.
- `python3 tools/scan.py --check` validates the committed `site/state.json`
  without a workspace. It proves the shape and the absence of sensitive text,
  not that the contents are current. CI can only do this one.

Drift is a failure: a folder on disk without a description, a description
without a folder, or a repository that `bootstrap/repos.txt` does not name.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Anything that looks like a secret stops the run. These are the patterns this
# workspace actually uses: LAN addresses, NAS volume paths, ssh keys, tokens.
SENSITIVE = (
    (re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b"), "ip address"),
    (re.compile(r"/volume\d+/"), "nas volume path"),
    (re.compile(r"(?:^|[\s(])~/\.ssh|/home/[a-z0-9_-]+/\.ssh"), "ssh key path"),
    (re.compile(r"-----BEGIN "), "private key"),
    (re.compile(r"\b(?:ghp|gho|ghu|ghs|github_pat|sk|xox[abps])_[A-Za-z0-9_-]{10,}"), "token"),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._-]{12,}"), "bearer token"),
)

CLOSED = ("secrets", "backups")
HIDDEN = (".git", ".opencode", ".venv", "node_modules", "test-results", "__pycache__")


class ScanError(RuntimeError):
    """Raised when the workspace and its descriptions disagree, or a secret leaks."""


def load_descriptions(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def read_repo_registry(root: Path) -> list[str]:
    path = root / "bootstrap" / "repos.txt"
    if not path.is_file():
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        entry = line.strip()
        if entry and not entry.startswith("#"):
            names.append(entry)
    return names


def git(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def repo_facts(path: Path, description: str | None) -> dict:
    manifest: dict = {}
    basics = path / "basics.json"
    if basics.is_file():
        try:
            manifest = json.loads(basics.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}
    origin = git(path, "remote", "get-url", "origin")
    owner = "github.com/suadin/" if origin and "github.com/suadin/" in origin else None
    return {
        "name": path.name,
        "description": description,
        "remote": bool(owner),
        "appVersion": manifest.get("appVersion"),
        "standard": manifest.get("standard"),
        "profiles": manifest.get("profiles", []),
        "deviations": len(manifest.get("deviations", [])),
        "lastCommit": git(path, "log", "-1", "--format=%cs"),
    }


def list_entries(name: str, root: Path, listing: str, descriptions: dict) -> list[str] | None:
    path = root / name
    if listing == "none" or not path.is_dir():
        return None if name in CLOSED else []
    if listing == "repos":
        names = read_repo_registry(root)
        extra = sorted(p.name for p in path.iterdir() if p.is_dir() and p.name not in names and p.name not in HIDDEN)
        return names + extra
    if listing == "dirs":
        return sorted(
            p.name
            for p in path.iterdir()
            if p.is_dir() and not p.name.startswith(".") and p.name not in HIDDEN
        )
    if listing == "files":
        return sorted(p.name for p in path.iterdir() if p.is_file() and not p.name.startswith("."))
    raise ScanError(f"unknown listing {listing!r} for folder {name!r}")


def scan(root: Path, descriptions: dict) -> dict:
    folders = descriptions.get("folders", {})
    drift: list[str] = []
    optional = {name for name, spec in folders.items() if spec.get("optional")}

    present = sorted(
        p.name
        for p in root.iterdir()
        if p.is_dir() and not p.name.startswith(".") and p.name not in HIDDEN
    )
    for name in present:
        if name not in folders:
            drift.append(f"folder exists without a description: {name}/")
    for name, spec in folders.items():
        if name not in present and name not in optional:
            drift.append(f"description without a folder: {name}/")

    rows = []
    for name, spec in folders.items():
        if name not in present:
            continue
        entries = list_entries(name, root, spec.get("listing", "none"), descriptions)
        rows.append(
            {
                "name": name,
                "role": spec.get("role", ""),
                "text": spec.get("text", ""),
                "public": bool(spec.get("public", True)),
                "detailed": bool(spec.get("detailed", False)),
                "entries": entries,
                "count": None if entries is None else len(entries),
            }
        )

    registry = read_repo_registry(root)
    repos_dir = root / "repos"
    on_disk = (
        sorted(p.name for p in repos_dir.iterdir() if p.is_dir() and (p / ".git").exists())
        if repos_dir.is_dir()
        else []
    )
    for name in registry:
        if name not in on_disk:
            drift.append(f"repository in bootstrap/repos.txt but not on disk: {name}")

    repo_descriptions = descriptions.get("repos", {})

    def described(name: str) -> tuple[str | None, bool]:
        spec = repo_descriptions.get(name)
        if spec is None:
            return None, False
        if isinstance(spec, str):
            return spec, False
        return spec.get("text"), bool(spec.get("localOnly"))

    for name in on_disk:
        text, local_only = described(name)
        if text is None:
            drift.append(f"repository exists without a description: {name}")
        if local_only and name in registry:
            drift.append(f"repository is marked local-only but restore.sh clones it: {name}")
        if not local_only and name not in registry:
            drift.append(f"repository exists but restore.sh would not clone it: {name}")

    repos = []
    for name in on_disk:
        text, local_only = described(name)
        facts = repo_facts(repos_dir / name, text)
        facts["localOnly"] = local_only
        facts["restored"] = name in registry and not local_only
        repos.append(facts)

    root_files = [
        {"name": name, "text": descriptions.get("files", {}).get(name, "")}
        for name in descriptions.get("rootFiles", [])
        if (root / name).exists()
    ]

    return {
        "generatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "workspace": "~/dev",
        "folders": rows,
        "files": root_files,
        "repos": repos,
        "drift": drift,
        "sensitive": "clean",
    }


def find_sensitive(value, key: str = "") -> list[str]:
    """Walk the document and name every key whose text looks like a secret."""
    found: list[str] = []
    if isinstance(value, dict):
        for name, item in value.items():
            found.extend(find_sensitive(item, f"{key}.{name}" if key else name))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found.extend(find_sensitive(item, f"{key}[{index}]"))
    elif isinstance(value, str):
        for pattern, label in SENSITIVE:
            if pattern.search(value):
                found.append(f"{key or 'document'}: looks like {label}")
    return found


def write_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(state, indent=2, ensure_ascii=False)}\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scan", description=__doc__.splitlines()[0])
    parser.add_argument("--root", default="~/dev", help="workspace root (default: ~/dev)")
    parser.add_argument("--descriptions", default=None, help="descriptions.json to read")
    parser.add_argument("--out", default=None, help="state file to write")
    parser.add_argument("--check", action="store_true", help="validate the committed state instead of scanning")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parent.parent
    out = Path(args.out).expanduser() if args.out else repo_root / "site" / "state.json"

    if args.check:
        if not out.is_file():
            print(f"scan: {out} is missing", file=sys.stderr)
            return 1
        state = json.loads(out.read_text(encoding="utf-8"))
        problems = find_sensitive(state)
        for name in ("generatedAt", "workspace", "folders", "repos", "drift"):
            if name not in state:
                problems.append(f"state is missing {name}")
        for item in state.get("drift", []):
            problems.append(f"drift: {item}")
        for row in state.get("folders", []):
            if not row.get("description", row.get("text")) and row.get("count") is not None:
                problems.append(f"folder without text: {row.get('name')}")
        if problems:
            for problem in problems:
                print(f"scan: {problem}", file=sys.stderr)
            return 1
        if not args.quiet:
            print(f"scan: {out.name} is well formed, {len(state.get('folders', []))} folders, no sensitive text")
        return 0

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"scan: {root} is not a directory", file=sys.stderr)
        return 1
    descriptions = load_descriptions(
        Path(args.descriptions).expanduser() if args.descriptions else repo_root / "descriptions.json"
    )
    state = scan(root, descriptions)

    leaks = find_sensitive(state)
    if leaks:
        for leak in leaks:
            print(f"scan: refused — {leak}", file=sys.stderr)
        print("scan: nothing written", file=sys.stderr)
        return 1

    write_state(out, state)
    if not args.quiet:
        print(f"scan: wrote {out}")
        print(f"scan: {len(state['folders'])} folders, {len(state['repos'])} repositories, {len(state['drift'])} drift")
    if state["drift"]:
        for item in state["drift"]:
            print(f"scan: drift — {item}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
