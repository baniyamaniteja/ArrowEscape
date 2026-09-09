#!/usr/bin/env bash
# Remove the per-user Arrow Escape install.
set -euo pipefail

DEST="${XDG_DATA_HOME:-$HOME/.local/share}/arrow-escape"
BIN="${XDG_BIN_HOME:-$HOME/.local/bin}/arrow-escape"
DESKTOP="${XDG_DATA_HOME:-$HOME/.local/share}/applications/arrow-escape.desktop"
ICON="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/256x256/apps/arrow-escape.png"

rm -f "$BIN" "$DESKTOP" "$ICON"
rm -rf "$DEST"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${XDG_DATA_HOME:-$HOME/.local/share}/applications" >/dev/null 2>&1 || true
fi

echo "Arrow Escape was uninstalled for this user."
