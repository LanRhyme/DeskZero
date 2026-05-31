# DeskZero

DeskZero is a modern, lightweight Windows desktop organization tool. It functions as a brand new desktop environment distinct from the native Windows desktop, providing customizable containers to help you manage and organize your files, shortcuts, and folders.

*Read this in other languages: [English](README.md), [简体中文](README_zh.md).*

## Features

- **A New Desktop Experience:** Acts as a standalone desktop layer separate from your native Windows desktop, giving you a fresh and organized workspace.
- **Containers:** Create customizable containers (fences/groups) to organize your desktop shortcuts and files.
- **Directory Index:** Map a container to an existing directory on your disk.
- **Customization:** Change container colors, styles, and toggle file extension visibility to match your preferences.
- **Global Context Menu:** Right-click on the desktop or containers to easily manage your workspace.
- **System Tray:** Quick access to application settings or exit via the system tray.
- **High Performance:** Built with Rust (Tauri v2) and React for minimal resource usage.
- **No Clutter:** Your configurations are safely stored in an internal SQLite database, keeping your filesystem clean.

## Installation

DeskZero is currently available for **Windows only**.

1. Go to the [Releases](https://github.com/LanRhyme/DeskZero/releases) page.
2. Download either the Installer (`DeskZero_x.x.x_x64-setup.exe`) or the Portable version (`DeskZero_x.x.x_x64-portable.exe`).
3. Run the application.

## Usage

- **Starting Up:** DeskZero runs in the background and its window is attached directly to your desktop.
- **Creating a Container:** Right-click on an empty space on your desktop and select the DeskZero option to create a new container.
- **Adding Items:** Drag and drop your shortcuts or files into containers.
- **Settings:** Access the settings menu by right-clicking the DeskZero system tray icon and selecting "Settings" (or from the desktop context menu). Here you can customize colors, file extensions, and more.

## License

[GPL-3.0 License](https://opensource.org/licenses/GPL-3.0)
