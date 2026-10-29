"""Tests for the workspace scanner.

The fixture is built in a temporary directory, so the suite runs the same on a
laptop and on a CI runner: it never reads this machine.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from tools import scan


def descriptions(**folders) -> dict:
    base = {
        "folders": {
            "repos": {"role": "projects", "text": "own history", "public": True, "listing": "repos"},
            "bootstrap": {"role": "restore", "text": "the list", "public": True, "listing": "files"},
            "skills": {"role": "capabilities", "text": "loaded on demand", "public": False, "listing": "dirs"},
            "configs": {"role": "rules", "text": "this machine", "public": False, "listing": "files"},
            "secrets": {"role": "tokens", "text": "closed", "public": False, "listing": "none"},
            "scratch": {"role": "throwaway", "text": "deleted", "public": False, "optional": True, "listing": "files"},
        },
        "repos": {"alpha": "first", "beta": "second"},
        "rootFiles": ["AGENTS.md"],
        "files": {"AGENTS.md": "the rules"},
    }
    base.update(folders)
    return base


class ScanTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "AGENTS.md").write_text("# rules\n", encoding="utf-8")
        self.write("bootstrap/repos.txt", "alpha\nbeta\n")
        for name, manifest in (("alpha", {"appVersion": "1.0.0", "standard": "1.1.1", "profiles": ["web-static"]}), ("beta", {})):
            self.write(f"repos/{name}/basics.json", json.dumps(manifest))
            (self.root / "repos" / name / ".git").mkdir(parents=True, exist_ok=True)
        self.write("skills/one/SKILL.md", "# one\n")
        self.write("configs/layout.json", "{}\n")
        (self.root / "secrets").mkdir()
        (self.root / "secrets" / "one.token").write_text("x", encoding="utf-8")
        self.write("scratch/note.txt", "gone tomorrow\n")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write(self, relative: str, content: str) -> Path:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def run_scan(self, **kwargs) -> dict:
        return scan.scan(self.root, descriptions(**kwargs))

    def test_folders_carry_counts_and_closed_folders_stay_closed(self):
        state = self.run_scan()
        rows = {row["name"]: row for row in state["folders"]}
        self.assertEqual(rows["repos"]["entries"], ["alpha", "beta"])
        self.assertEqual(rows["repos"]["count"], 2)
        self.assertEqual(rows["skills"]["entries"], ["one"])
        self.assertEqual(rows["configs"]["entries"], ["layout.json"])
        self.assertIsNone(rows["secrets"]["entries"])
        self.assertIsNone(rows["secrets"]["count"])
        self.assertNotIn("one.token", json.dumps(state))

    def test_a_tree_without_drift_reports_none(self):
        self.assertEqual(self.run_scan()["drift"], [])

    def test_a_folder_without_a_description_is_drift(self):
        (self.root / "unexpected").mkdir()
        self.assertIn(
            "folder exists without a description: unexpected/",
            self.run_scan()["drift"],
        )

    def test_a_description_without_a_folder_is_drift_unless_optional(self):
        (self.root / "configs").rename(self.root / "configs-gone")
        drift = self.run_scan()["drift"]
        self.assertIn("description without a folder: configs/", drift)
        self.assertNotIn("description without a folder: scratch/", drift)

    def test_an_undescribed_repository_is_drift(self):
        self.write("repos/gamma/basics.json", "{}")
        (self.root / "repos" / "gamma" / ".git").mkdir()
        drift = self.run_scan()["drift"]
        self.assertIn("repository exists without a description: gamma", drift)
        self.assertIn("repository exists but restore.sh would not clone it: gamma", drift)

    def test_a_local_only_repository_needs_no_registry_entry(self):
        self.write("repos/gamma/basics.json", "{}")
        (self.root / "repos" / "gamma" / ".git").mkdir()
        local = descriptions()
        local["repos"] = {"alpha": "first", "beta": "second", "gamma": {"text": "only here", "localOnly": True}}
        state = scan.scan(self.root, local)
        self.assertEqual(state["drift"], [])
        rows = {row["name"]: row for row in state["repos"]}
        self.assertTrue(rows["gamma"]["localOnly"])
        self.assertFalse(rows["gamma"]["restored"])
        self.assertTrue(rows["alpha"]["restored"])

    def test_a_local_only_repository_must_not_be_in_the_registry(self):
        local = descriptions()
        local["repos"] = {"alpha": {"text": "first", "localOnly": True}, "beta": "second"}
        drift = scan.scan(self.root, local)["drift"]
        self.assertIn("repository is marked local-only but restore.sh clones it: alpha", drift)

    def test_repository_facts_come_from_the_manifest(self):
        rows = {row["name"]: row for row in self.run_scan()["repos"]}
        self.assertEqual(rows["alpha"]["appVersion"], "1.0.0")
        self.assertEqual(rows["alpha"]["standard"], "1.1.1")
        self.assertEqual(rows["alpha"]["profiles"], ["web-static"])
        self.assertEqual(rows["alpha"]["deviations"], 0)
        self.assertIsNone(rows["beta"]["appVersion"])
        self.assertFalse(rows["alpha"]["remote"])
        self.assertIsNone(rows["alpha"]["lastCommit"])

    def test_root_files_are_named_not_read(self):
        state = self.run_scan()
        self.assertEqual([item["name"] for item in state["files"]], ["AGENTS.md"])
        self.assertEqual(state["files"][0]["text"], "the rules")


class SensitiveTest(unittest.TestCase):
    def test_an_address_blocks_the_document(self):
        found = scan.find_sensitive({"text": "reach it at 192.168.178.50"})
        self.assertEqual(found, ["text: looks like ip address"])

    def test_a_volume_path_blocks_the_document(self):
        found = scan.find_sensitive({"folders": [{"text": "see /volume1/docker"}]})
        self.assertTrue(found)
        self.assertIn("looks like nas volume path", found[0])

    def test_a_token_blocks_the_document(self):
        self.assertTrue(scan.find_sensitive({"note": "use ghp_" + "a" * 20}))
        self.assertTrue(scan.find_sensitive({"note": "Bearer " + "a" * 20}))

    def test_plain_prose_passes(self):
        clean = {"text": "Projects with their own history, cloned by restore.sh.", "n": 3, "ok": True, "none": None}
        self.assertEqual(scan.find_sensitive(clean), [])

    def test_the_scanner_refuses_to_write_a_leak(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "repos").mkdir()
            out = root / "state.json"
            leaky = Path(temp) / "descriptions.json"
            leaky.write_text(json.dumps({
                "folders": {"repos": {"role": "x", "text": "at 10.0.0.1", "listing": "repos"}},
                "repos": {},
            }), encoding="utf-8")
            code = scan.main(["--root", temp, "--descriptions", str(leaky), "--out", str(out), "--quiet"])
            self.assertEqual(code, 1)
            self.assertFalse(out.exists())


class CommandTest(unittest.TestCase):
    def test_check_accepts_a_clean_file(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / "state.json"
            scan.write_state(out, {"generatedAt": "2026-10-29T11:00", "workspace": "~/dev",
                                   "folders": [], "files": [], "repos": [], "drift": [], "sensitive": "clean"})
            self.assertEqual(scan.main(["--check", "--out", str(out), "--quiet"]), 0)

    def test_check_rejects_a_leak_in_the_committed_file(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / "state.json"
            scan.write_state(out, {"generatedAt": "2026-10-29T11:00", "workspace": "~/dev",
                                   "folders": [{"name": "secrets", "text": "10.0.0.1", "count": None}],
                                   "files": [], "repos": [], "drift": [], "sensitive": "clean"})
            self.assertEqual(scan.main(["--check", "--out", str(out), "--quiet"]), 1)

    def test_check_rejects_drift(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / "state.json"
            scan.write_state(out, {"generatedAt": "2026-10-29T11:00", "workspace": "~/dev",
                                   "folders": [], "files": [], "repos": [], "drift": ["one"], "sensitive": "clean"})
            self.assertEqual(scan.main(["--check", "--out", str(out), "--quiet"]), 1)


if __name__ == "__main__":
    unittest.main()
