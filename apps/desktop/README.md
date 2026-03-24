# MFO Nexus Desktop

Electron shell that shows MFO Nexus CRM and WhatsApp Web side-by-side in a single desktop window.

## Run (development)

```bash
# From repo root — install Electron deps first (once)
cd apps/desktop
pnpm install

# Launch the desktop app (CRM loads from production URL)
cd ../..
pnpm desktop
```

## Build installer

```bash
# Windows .exe
pnpm desktop:build

# macOS .dmg
pnpm -C apps/desktop build:mac

# Linux AppImage
pnpm -C apps/desktop build:linux
```

Output goes to `apps/desktop/dist/`.

## Features

| Feature | Description |
|---|---|
| Split panel | CRM on the left, WhatsApp Web on the right |
| Draggable divider | Resize panels by dragging the divider bar |
| Persisted WhatsApp session | WA login survives restarts (Electron userData) |
| Persisted panel width | Last divider position restored on launch |
| Toggle WhatsApp | `Ctrl+W` or toolbar button hides/shows WA panel |
| Reload CRM | `Ctrl+R` |
| Single instance | Only one window opens at a time |
| Open-chat IPC | CRM can navigate WA to a phone number via `window.electronAPI.openWhatsAppChat(phone)` |

## Why Electron for WhatsApp?

WhatsApp Web sets `X-Frame-Options: SAMEORIGIN`, which blocks `<iframe>` in any regular browser context.  
Electron's `<webview>` tag bypasses this restriction, making a true side-by-side layout possible.
