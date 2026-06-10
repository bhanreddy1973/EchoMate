#!/usr/bin/env bash
# Refresh all skills from their remote repositories.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST="$ROOT_DIR/.agents/skills/skills-manifest.json"

if [ ! -f "$MANIFEST" ]; then
    echo "No skills manifest found at $MANIFEST. Run scripts/setup.sh first."
    exit 1
fi

echo "==> Refreshing skills from manifest..."

# Parse manifest with Python (avoids jq dependency)
python3 - <<PYEOF
import json, subprocess, datetime, sys
from pathlib import Path

root = Path("$ROOT_DIR")
manifest_path = Path("$MANIFEST")

with open(manifest_path) as f:
    manifest = json.load(f)

for skill in manifest.get("skills", []):
    name = skill["name"]
    local_path = root / skill["local_path"]
    print(f"  Refreshing {name}...")
    if local_path.is_dir() and (local_path / ".git").is_dir():
        result = subprocess.run(
            ["git", "-C", str(local_path), "pull", "--ff-only"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            skill["last_updated"] = datetime.datetime.utcnow().isoformat() + "Z"
            print(f"    OK: {result.stdout.strip()}")
        else:
            print(f"    Warning: {result.stderr.strip()}")
    else:
        print(f"    Cloning {skill['url']} into {local_path}...")
        local_path.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            ["git", "clone", "--depth", "1", skill["url"], str(local_path)],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            skill["last_updated"] = datetime.datetime.utcnow().isoformat() + "Z"
        else:
            print(f"    Error: {result.stderr.strip()}")

with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)

print("==> Skills refresh complete.")
PYEOF
