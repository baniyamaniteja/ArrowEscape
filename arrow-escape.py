```python
#!/usr/bin/env python3
"""Arrow Escape — native Linux window (GTK + WebKit)."""

from __future__ import annotations

import os
import pathlib
import sys


# Flatpak installs the read-only game files under /app/share/arrow-escape.
# Keep a fallback to the source directory so the program can still be run
# directly during development.
APP_DIR = pathlib.Path("/app/share/arrow-escape")

if APP_DIR.is_dir():
    HERE = APP_DIR
else:
    HERE = pathlib.Path(__file__).resolve().parent

INDEX = HERE / "www" / "index.html"

# The icon is installed separately by Flatpak, but keep the local fallback.
SYSTEM_ICON = pathlib.Path(
    "/app/share/icons/hicolor/256x256/apps/"
    "io.github.baniyamaniteja.ArrowEscape.png"
)
LOCAL_ICON = HERE / "icon.png"

if SYSTEM_ICON.is_file():
    ICON = SYSTEM_ICON
else:
    ICON = LOCAL_ICON


def get_user_data_dir() -> pathlib.Path:
    """Return the application's writable user-data directory."""

    # XDG_DATA_HOME is the correct location for application data on Linux.
    # Flatpak provides an appropriate sandboxed XDG environment.
    xdg_data_home = os.environ.get("XDG_DATA_HOME")

    if xdg_data_home:
        base = pathlib.Path(xdg_data_home)
    else:
        base = pathlib.Path.home() / ".local" / "share"

    return base / "arrow-escape"


def fail(message: str) -> None:
    sys.stderr.write(message + "\n")
    raise SystemExit(2)


def load_webkit():
    try:
        import gi
    except ImportError:
        fail("PyGObject (python3-gi) is not installed")

    gtk = None
    webkit = None

    for wk_ver in ("4.1", "4.0"):
        try:
            gi.require_version("Gtk", "3.0")
            gi.require_version("WebKit2", wk_ver)

            from gi.repository import Gtk as gtk_mod
            from gi.repository import WebKit2 as webkit_mod

            gtk = gtk_mod
            webkit = webkit_mod
            break

        except (ValueError, ImportError):
            continue

    if gtk is None or webkit is None:
        fail(
            "WebKitGTK is not installed.\n"
            "Arrow Escape requires WebKitGTK 4.1."
        )

    from gi.repository import Gdk, GLib

    return gtk, webkit, Gdk, GLib


def configure_settings(view, webkit) -> None:
    """Configure WebKit for the local Arrow Escape game."""

    settings = view.get_settings()

    settings_to_apply = (
        ("enable_javascript", True),
        ("enable_html5_local_storage", True),
        ("enable_offline_web_application_cache", True),
        ("enable_developer_extras", False),
        ("enable_smooth_scrolling", True),
        ("enable_page_cache", True),
        ("allow_file_access_from_file_urls", True),
        ("allow_universal_access_from_file_urls", False),
        ("enable_write_console_messages_to_stdout", False),
        ("hardware_acceleration_policy", 1),
    )

    for name, value in settings_to_apply:
        setter = "set_" + name

        if hasattr(settings, setter):
            try:
                getattr(settings, setter)(value)
            except Exception:
                # WebKit versions can expose different settings.
                # Ignore unsupported optional settings.
                pass

    try:
        settings.set_user_agent_with_application_details(
            "ArrowEscape",
            "4.2.5",
        )
    except Exception:
        pass


def main() -> None:
    if not INDEX.is_file():
        fail("Game files missing: " + str(INDEX))

    Gtk, WebKit, Gdk, GLib = load_webkit()

    GLib.set_prgname("arrow-escape")

    try:
        Gdk.set_program_class("Arrow Escape")
    except Exception:
        pass

    # Create the writable application data directory.
    user_data = get_user_data_dir()

    try:
        user_data.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        fail(f"Unable to create application data directory: {exc}")

    uri = INDEX.as_uri()

    # Main window.
    win = Gtk.Window(title="Arrow Escape")
    win.set_default_size(480, 860)
    win.set_size_request(380, 640)

    win.connect("destroy", Gtk.main_quit)

    if ICON.is_file():
        try:
            win.set_icon_from_file(str(ICON))
        except Exception:
            pass

    # WebKit view.
    view = WebKit.WebView()

    configure_settings(view, WebKit)

    try:
        rgba = Gdk.RGBA()
        rgba.parse("#f3eee4")
        view.set_background_color(rgba)
    except Exception:
        pass

    def on_decide(web_view, decision, decision_type):
        """Open external links in the user's default browser."""

        try:
            nav = decision.get_request().get_uri()
        except Exception:
            return False

        # Allow navigation between local game files.
        if nav.startswith("file:"):
            return False

        # Open external URLs using the desktop environment.
        try:
            Gtk.show_uri_on_window(
                win,
                nav,
                Gdk.CURRENT_TIME,
            )
            decision.ignore()
            return True

        except Exception:
            return False

    try:
        view.connect(
            "decide-policy",
            on_decide,
        )
    except Exception:
        pass

    # Load the local game.
    view.load_uri(uri)

    win.add(view)
    win.show_all()

    Gtk.main()


if __name__ == "__main__":
    main()
```
