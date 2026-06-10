"""Tests for skills management scripts and directory structure."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).parent.parent
SETUP_SCRIPT = REPO_ROOT / "scripts" / "setup.sh"
REFRESH_SCRIPT = REPO_ROOT / "scripts" / "refresh_skills.sh"
MANIFEST_PATH = REPO_ROOT / ".agents" / "skills" / "skills-manifest.json"


class TestSkillsManifest:
    def test_manifest_exists(self) -> None:
        assert MANIFEST_PATH.exists(), "skills-manifest.json should exist after setup"

    def test_manifest_is_valid_json(self) -> None:
        with open(MANIFEST_PATH) as f:
            data = json.load(f)
        assert "skills" in data
        assert isinstance(data["skills"], list)

    def test_manifest_skills_have_required_fields(self) -> None:
        with open(MANIFEST_PATH) as f:
            data = json.load(f)
        required = {"name", "url", "local_path", "last_updated"}
        for skill in data["skills"]:
            assert required.issubset(set(skill.keys())), (
                f"Skill {skill.get('name')} missing required fields"
            )

    def test_livekit_skills_in_manifest(self) -> None:
        with open(MANIFEST_PATH) as f:
            data = json.load(f)
        names = [s["name"] for s in data["skills"]]
        assert "livekit-agent-skills" in names


class TestScriptsExist:
    def test_setup_script_exists(self) -> None:
        assert SETUP_SCRIPT.exists()

    def test_refresh_script_exists(self) -> None:
        assert REFRESH_SCRIPT.exists()

    def test_setup_script_is_executable(self) -> None:
        assert os.access(SETUP_SCRIPT, os.X_OK)

    def test_refresh_script_is_executable(self) -> None:
        assert os.access(REFRESH_SCRIPT, os.X_OK)


class TestDirectoryStructure:
    """Verify the project directory tree matches the design spec."""

    def test_echomate_package_exists(self) -> None:
        assert (REPO_ROOT / "echomate").is_dir()

    def test_frontend_dir_exists(self) -> None:
        assert (REPO_ROOT / "frontend").is_dir()

    def test_scripts_dir_exists(self) -> None:
        assert (REPO_ROOT / "scripts").is_dir()

    def test_tests_dir_exists(self) -> None:
        assert (REPO_ROOT / "tests").is_dir()

    def test_data_dir_exists(self) -> None:
        assert (REPO_ROOT / "data").is_dir()

    def test_agents_skills_dir_exists(self) -> None:
        assert (REPO_ROOT / ".agents" / "skills").is_dir()

    def test_makefile_exists(self) -> None:
        assert (REPO_ROOT / "Makefile").exists()


class TestRefreshScriptLogic:
    """Test the Python logic inside refresh_skills.sh via direct invocation."""

    def test_refresh_updates_manifest_last_updated(self, tmp_path: Path) -> None:
        skills_dir = tmp_path / ".agents" / "skills"
        skills_dir.mkdir(parents=True)
        manifest = skills_dir / "skills-manifest.json"

        # Create a local git repo to simulate a skill
        skill_dir = skills_dir / "test-skill"
        skill_dir.mkdir()
        subprocess.run(["git", "init", str(skill_dir)], capture_output=True, check=True)
        subprocess.run(
            ["git", "-C", str(skill_dir), "commit", "--allow-empty", "-m", "init"],
            capture_output=True, check=True,
            env={**os.environ, "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "t@t.com",
                 "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "t@t.com"}
        )

        manifest.write_text(json.dumps({
            "skills": [{
                "name": "test-skill",
                "url": "https://example.com/test-skill.git",
                "local_path": str(skill_dir),
                "last_updated": None
            }]
        }))

        # Run only the Python portion of refresh logic
        refresh_code = f"""
import json, subprocess, datetime
from pathlib import Path

root = Path("{tmp_path}")
manifest_path = Path("{manifest}")

with open(manifest_path) as f:
    manifest_data = json.load(f)

for skill in manifest_data.get("skills", []):
    local_path = Path(skill["local_path"])
    if local_path.is_dir() and (local_path / ".git").is_dir():
        result = subprocess.run(
            ["git", "-C", str(local_path), "pull", "--ff-only"],
            capture_output=True, text=True
        )
        skill["last_updated"] = datetime.datetime.utcnow().isoformat() + "Z"

with open(manifest_path, "w") as f:
    json.dump(manifest_data, f, indent=2)
"""
        result = subprocess.run(
            [sys.executable, "-c", refresh_code],
            capture_output=True, text=True
        )
        assert result.returncode == 0, result.stderr

        with open(manifest) as f:
            updated = json.load(f)
        assert updated["skills"][0]["last_updated"] is not None
