# MAARE - Match And Replace Extension

A lightweight Chrome extension that intercepts and modifies HTTP requests and responses directly in the browser. Think of it as Burp Suite's Match & Replace, but running entirely in your browser with zero setup.

![Chrome](https://img.shields.io/badge/Chrome-MV3-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## What it does

MAARE injects into every page and overrides the browser's native `fetch` and `XMLHttpRequest` APIs. When an HTTP call matches one of your rules, it swaps the matched string with your replacement - on the fly, before the page ever sees the response.

**Supported rule types:**

| Type | What it modifies |
|------|-----------------|
| Request header | Header names and values on outgoing requests |
| Request body | The body payload of outgoing requests |
| Request param name | URL parameter names |
| Request param value | URL parameter values |
| Request first line | The URL and HTTP method |
| Response header | Header names and values on incoming responses |
| Response body | The body content of incoming responses |

## Use cases

- **Bug bounty / pentesting** - Modify API responses to test client-side validation, bypass front-end restrictions, or tamper with request parameters
- **Development** - Mock API responses without touching backend code, test edge cases by injecting specific response payloads
- **Debugging** - Inspect and modify live traffic to isolate issues

## Installation

1. Clone this repo:
   ```bash
   git clone https://github.com/iamyuthan/MAARE.git
   ```
   Or download the latest version from release and unzip it.
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `MAARE` folder

## Usage

1. Click the MAARE extension icon in the toolbar to open the popup
2. Select a **rule type** (e.g., `Response body`)
3. Enter the **Match** string (the text to find)
4. Enter the **Replace** string (the text to substitute)
5. Click **Add Rule**

Rules take effect immediately on all tabs. No page reload needed.

### Managing rules

- **Enable/Disable** - Toggle individual rules with the left checkbox
- **Edit** - Click the pencil icon to load a rule back into the form
- **Delete** - Click the X icon to remove a rule
- **Import/Export** - Share rule sets as JSON files. Use the right checkbox to select specific rules for export.

### Example

Replace a null score with a perfect score in API responses:

| Field | Value |
|-------|-------|
| Type | Response body |
| Match | `{"Score":null}` |
| Replace | `{"Score":"100"}` |

## How it works

1. **popup.js** - UI for creating, editing, and managing rules. Stores rules in `chrome.storage.local`
2. **content.js** - Content script that injects `injected.js` into every page and forwards rule updates via `postMessage`
3. **injected.js** - Runs in the page context. Overrides `window.fetch` and `XMLHttpRequest.prototype` to intercept and modify traffic based on active rules

## Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Persist rules across sessions |
| `scripting` | Inject the content script |
| `<all_urls>` | Intercept traffic on any page |

## Author

**Yuthan Balaji K**
- GitHub: [@iamyuthan](https://github.com/iamyuthan)

## License

[MIT](LICENSE)
