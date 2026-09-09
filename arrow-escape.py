#!/usr/bin/env python3
"""Arrow Escape — native Linux window (GTK + WebKit)."""
from __future__ import annotations

import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
INDEX = HERE / "www" / "index.html"
ICON = HERE / "icon.png"
USER_DATA = pathlib.Path.home() / ".local" / "share" / "arrow-escape"


def fail(message: str) -> None:
    sys.stderr.write(message + "\n")
    raise SystemExit(2)


def load_webkit():
    try:
        import gi
    except ImportError:
        fail("python3-gi is not installed")

    gtk = None
    webkit = None
    for wk_ver in ("4.1", "4.0"):
        try:
            gi.require_version("Gtk", "3.0")
            gi.require_version("WebKit2", wk_ver)
            from gi.repository import Gtk as gtk_mod  # type: ignore
            from gi.repository import WebKit2 as webkit_mod  # type: ignore
            gtk = gtk_mod
            webkit = webkit_mod
            break
        except (ValueError, ImportError):
            continue
    if gtk is None or webkit is None:
        fail(
            "WebKitGTK is not installed. On Ubuntu run:\n"
            "  sudo apt install python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.1"
        )
    from gi.repository import Gdk, GLib  # type: ignore

    return gtk, webkit, Gdk, GLib


def configure_settings(view, webkit) -> None:
    settings = view.get_settings()
    for name, value in (
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
    ):
        setter = "set_" + name
        if hasattr(settings, setter):
            try:
                getattr(settings, setter)(value)
            except Exception:
                pass
    try:
        settings.set_user_agent_with_application_details("ArrowEscape", "4.2.5")
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

    USER_DATA.mkdir(parents=True, exist_ok=True)
    uri = INDEX.as_uri()

    win = Gtk.Window(title="Arrow Escape")
    win.set_default_size(480, 860)
    win.set_size_request(380, 640)
    win.connect("destroy", Gtk.main_quit)
    if ICON.is_file():
        try:
            win.set_icon_from_file(str(ICON))
        except Exception:
            pass

    view = WebKit.WebView()
    configure_settings(view, WebKit)
    try:
        rgba = Gdk.RGBA()
        rgba.parse("#f3eee4")
        view.set_background_color(rgba)
    except Exception:
        pass

    def on_decide(web_view, decision, decision_type):
        try:
            nav = decision.get_request().get_uri()
        except Exception:
            return False
        if nav.startswith("file:"):
            return False
        try:
            Gtk.show_uri_on_window(win, nav, Gdk.CURRENT_TIME)
            decision.ignore()
            return True
        except Exception:
            return False

    if hasattr(view, "connect"):
        try:
            view.connect("decide-policy", on_decide)
        except Exception:
            pass

    view.load_uri(uri)
    win.add(view)
    win.show_all()
    Gtk.main()


if __name__ == "__main__":
    os.chdir(HERE)
    main()
