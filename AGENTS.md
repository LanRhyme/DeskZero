# DeskZero

Tauri v2 desktop app (Windows-only). React 19 + TypeScript frontend, Rust backend. Embeds into the Windows desktop layer between wallpaper and icons.

## Commands

```bash
npm run dev          # Start Vite dev server (port 1420)
npm run build        # tsc -b && vite build
npm run tauri dev    # Run Tauri app in dev mode (starts frontend automatically)
npm run tauri build  # Build release binary
```

No lint, typecheck, test, or formatter scripts exist on the frontend side. Run `tsc -b` (no emit) for type checking.

Rust tests: `cargo test` from `src-tauri/`.

## Architecture

### Frontend (`src/`)

- Entry: `main.tsx` -> `App.tsx` routes by URL path (`/` = desktop, `/settings` = settings page)
- State: Zustand stores (`stores/`): `containerStore`, `desktopStore`, `settingsStore`
- Services (`services/`): call Tauri `invoke()` for IPC with the Rust backend
- Path alias: `@/*` maps to `./src/*`
- Tailwind CSS v4 (CSS-based config via `@import "tailwindcss"` in `styles/globals.css`)
- Theme: CSS variables on `:root` and `[data-theme="dark"]`, applied via `data-theme` attribute
- Utility: `cn.ts` uses `clsx` + `tailwind-merge`

### Rust backend (`src-tauri/src/`)

- Entry: `main.rs` -> `lib.rs::run()` — sets up Tauri, embeds window into Windows desktop layer
- `commands/` — Tauri invoke handlers: `container`, `desktop`, `file`, `system`
- `models/` — data types: `container`, `item`, `settings`
- `storage/` — JSON file persistence: `container_store`, `settings_store`
- `desktop/` — Windows desktop integration: `icon_scanner`, `shortcut`, `watcher`
- `clipboard.rs` — file clipboard operations
- `context_menu.rs` — Windows context menu

### Key behavior

- Main window starts hidden, gets embedded into Windows Progman/WorkerW layer (retries 3x)
- Settings window is a separate Tauri window, communicates via events (`settings-updated`)
- Desktop file watcher notifies frontend of filesystem changes
- Release profile: `lto = true`, `opt-level = "s"`, `strip = true`

## Conventions

- No ESLint, Prettier, or CI configured
- Chinese comments throughout Rust and TypeScript code — maintain this style
- Rust tests are inline `#[cfg(test)]` modules in separate `*_test.rs` files
- Frontend has no tests
- Use `eprintln!` for Rust debug logging (visible in terminal, not in app)
