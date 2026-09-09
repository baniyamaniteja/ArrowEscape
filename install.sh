#!/usr/bin/env bash
# Install Arrow Escape for this Linux user (no sudo).
set -euo pipefail

PRODUCT="Arrow Escape"
VERSION="4.2.5"
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/arrow-escape"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/256x256/apps"

if [[ ! -f "$HERE/www/index.html" ]]; then
  echo "Unzip the full ArrowEscape Linux folder first." >&2
  exit 1
fi

mkdir -p "$DEST" "$BIN_DIR" "$APP_DIR" "$ICON_DIR"

if [[ "$(readlink -f "$HERE")" != "$(readlink -f "$DEST")" ]]; then
  rm -rf "$DEST"
  mkdir -p "$DEST"
  cp -a "$HERE/." "$DEST/"
fi

chmod +x "$DEST/arrow-escape" "$DEST/arrow-escape.py" "$DEST/install.sh" "$DEST/uninstall.sh"

ln -sfn "$DEST/arrow-escape" "$BIN_DIR/arrow-escape"
cp -f "$DEST/icon.png" "$ICON_DIR/arrow-escape.png"

cat > "$APP_DIR/arrow-escape.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.5
Name=Arrow Escape
GenericName=Puzzle Game
Comment=Silhouette arrow-exit puzzle (v$VERSION)
Exec=$DEST/arrow-escape
Icon=$DEST/icon.png
Path=$DEST
Terminal=false
Categories=Game;LogicGame;PuzzleGame;
Keywords=puzzle;arrow;daily;silhouette;
StartupNotify=true
StartupWMClass=Arrow Escape
EOF
chmod 644 "$APP_DIR/arrow-escape.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
fi
if command -v xdg-desktop-menu >/dev/null 2>&1; then
  xdg-desktop-menu forceupdate >/dev/null 2>&1 || true
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo "Add $BIN_DIR to PATH to run 'arrow-escape' from a terminal."
    ;;
esac

echo "$PRODUCT $VERSION installed."
echo "  Game:     $DEST"
echo "  Launcher: $APP_DIR/arrow-escape.desktop"
echo "  Command:  $BIN_DIR/arrow-escape"
echo "Uninstall with: $DEST/uninstall.sh"

if command -v gtk-launch >/dev/null 2>&1; then
  gtk-launch arrow-escape >/dev/null 2>&1 || "$DEST/arrow-escape" >/dev/null 2>&1 &
else
  "$DEST/arrow-escape" >/dev/null 2>&1 &
fi
