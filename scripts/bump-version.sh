#!/usr/bin/env bash
# ── bump-version.sh ──────────────────────────────────────────────────────────
# Bumps the semver patch version across all config files in one atomic step.
# Usage:  ./scripts/bump-version.sh [major|minor|patch]
# Default: patch
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PART="${1:-patch}"

# ── Read current version from package.json ────────────────────────────────────
CURRENT=$(grep -oP '"version"\s*:\s*"\K[0-9]+\.[0-9]+\.[0-9]+' "$PROJECT_ROOT/package.json" | head -1)

if [ -z "$CURRENT" ]; then
  echo "Error: Could not read version from package.json"
  exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

# ── Calculate next version ────────────────────────────────────────────────────
case "$PART" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *)
    echo "Usage: $0 [major|minor|patch]"
    exit 1
    ;;
esac

NEXT="${MAJOR}.${MINOR}.${PATCH}"

echo "Bumping version: $CURRENT → $NEXT ($PART)"

# ── Update package.json ──────────────────────────────────────────────────────
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEXT\"/" "$PROJECT_ROOT/package.json"

# ── Update tauri.conf.json ───────────────────────────────────────────────────
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEXT\"/" "$PROJECT_ROOT/src-tauri/tauri.conf.json"

# ── Update Cargo.toml ────────────────────────────────────────────────────────
sed -i "s/^version = \"$CURRENT\"/version = \"$NEXT\"/" "$PROJECT_ROOT/src-tauri/Cargo.toml"

echo "Updated:"
echo "  package.json        → $NEXT"
echo "  tauri.conf.json     → $NEXT"
echo "  Cargo.toml          → $NEXT"
