#!/usr/bin/env bash
# EchoMate setup script — install Python deps and clone LiveKit agent skills.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="$ROOT_DIR/.agents/skills"
MANIFEST="$SKILLS_DIR/skills-manifest.json"

echo "==> Setting up EchoMate..."

# Python virtual environment and dependencies
if [ ! -d "$ROOT_DIR/.venv" ]; then
    echo "  Creating Python virtual environment..."
    python3 -m venv "$ROOT_DIR/.venv"
fi

echo "  Installing Python dependencies..."
"$ROOT_DIR/.venv/bin/pip" install -e "$ROOT_DIR[dev]" --quiet

# Create skills directory structure
mkdir -p "$SKILLS_DIR"

# Clone LiveKit agent skills if not already present
LIVEKIT_SKILLS_DIR="$SKILLS_DIR/livekit-agent-skills"
if [ ! -d "$LIVEKIT_SKILLS_DIR" ]; then
    echo "  Cloning livekit/agent-skills..."
    git clone --depth 1 "https://github.com/livekit/agent-skills.git" "$LIVEKIT_SKILLS_DIR" 2>/dev/null || {
        echo "  Warning: Could not clone agent-skills (network may be unavailable). Skipping."
        mkdir -p "$LIVEKIT_SKILLS_DIR"
    }
fi

# Write skills manifest
if [ ! -f "$MANIFEST" ]; then
    echo "  Writing skills manifest..."
    cat > "$MANIFEST" << 'EOF'
{
  "skills": [
    {
      "name": "livekit-agent-skills",
      "url": "https://github.com/livekit/agent-skills.git",
      "local_path": ".agents/skills/livekit-agent-skills",
      "last_updated": null
    }
  ]
}
EOF
fi

# Frontend dependencies
if [ -f "$ROOT_DIR/frontend/package.json" ]; then
    echo "  Installing frontend dependencies..."
    (cd "$ROOT_DIR/frontend" && npm install --silent) || echo "  Warning: npm install failed"
fi

echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and fill in your API keys"
echo "  2. Run 'make dev' to start the agent"
