#!/usr/bin/env bash
# Opens iPhone 15 Pro Max for 6.7" App Store screenshots (1290×2796).
set -euo pipefail

DEVICE_NAME="${SCREENSHOT_DEVICE:-iPhone 15 Pro Max}"

if ! xcode-select -p &>/dev/null; then
  echo "Xcode command line tools required. Install Xcode from the App Store."
  exit 1
fi

UDID=$(xcrun simctl list devices available | grep "$DEVICE_NAME (" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

if [[ -z "${UDID:-}" ]]; then
  echo "Simulator not found: $DEVICE_NAME"
  echo "Install via Xcode → Settings → Platforms, or pick another device:"
  xcrun simctl list devices available | grep iPhone
  exit 1
fi

open -a Simulator
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
echo "Ready: $DEVICE_NAME ($UDID)"
echo "Run: npx expo start  then press i in the Expo terminal."
