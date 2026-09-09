Arrow Escape 4.2.5 for Ubuntu / Linux
=====================================

Silhouette arrow-exit puzzle. Same campaign, daily challenge, and calendar
as the Android and Windows builds.

Install (this user, no sudo)
----------------------------
1. Unzip ArrowEscape-linux.zip
2. Open a terminal in the unzipped folder
3. Run:

     chmod +x install.sh
     ./install.sh

The game appears in the Applications menu as "Arrow Escape".
A command `arrow-escape` is also added to ~/.local/bin.

Uninstall
---------
  ~/.local/share/arrow-escape/uninstall.sh

If the window does not open
---------------------------
Install the WebKitGTK engine (Ubuntu / Debian):

  sudo apt update
  sudo apt install python3-gi python3-gi-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.1

On older Ubuntu (20.04):

  sudo apt install python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.0

The launcher will also use Google Chrome / Chromium / Brave in app mode
if WebKitGTK is missing.

System package (.deb)
---------------------
  sudo apt install ./arrow-escape_4.2.5_all.deb

Remove with:

  sudo apt remove arrow-escape

Progress is stored in the browser/WebKit profile for this user.
