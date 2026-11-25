Automatically copies text you highlight in Paseo to the system clipboard as soon as you release the primary mouse button, and shows a brief "Copied" indicator in the bottom-right corner.

## How it works

The plugin listens for primary-button `mouseup` events in the Paseo client document. When a non-empty text selection is active outside editable inputs (`input`, `textarea`, and `contenteditable` elements), it writes the selected text to the clipboard using `navigator.clipboard.writeText` with a `document.execCommand("copy")` fallback.

## Requirements and limits

- Works on the Paseo desktop (Electron) and web clients. It is a no-op on iOS and Android native clients.
- Requires Paseo 0.17.0 or later.
- No daemon-side code, external dependencies, network requests, or filesystem access.
- Only reads the currently selected text in the client window and writes it to the local clipboard.
