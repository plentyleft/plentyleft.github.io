#!/usr/bin/env bash
# Saves a screenshot from the booted iOS Simulator.
# Usage: ./scripts/capture-ios-screenshot.sh 03-corp-my-listings
set -euo pipefail

NAME="${1:?Usage: capture-ios-screenshot.sh <basename>}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/app-store/screenshots/6.7-inch"
mkdir -p "$DIR"
OUT="$DIR/${NAME}.png"

xcrun simctl io booted screenshot "$OUT"
echo "Saved $OUT ($(file -b "$OUT" 2>/dev/null || echo 'screenshot'))"
