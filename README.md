# Japanese Homework Assistant

`jphw` automates repetitive Google Form drills by launching a browser (Chromium
by default), scraping each question, and sending them to an AI-backed server for
answers. The project ships as a cross-platform CLI plus a Deno server that
proxies OpenRouter. This guide walks through first-time setup on macOS, Linux,
and Windows.

## Prerequisites

- An [OpenRouter](https://openrouter.ai/) account and API key
- Playwright downloads Chromium automatically; pass `--firefox` if you prefer
  Firefox
- Deno v1.39+ if you plan to run from source or start the server locally

## 1. Download the CLI

1. Visit the latest GitHub Release for this repository.
2. Download the binary that matches your platform:
   - macOS (Intel): `jphw-x86_64-apple-darwin`
   - macOS (Apple Silicon): `jphw-aarch64-apple-darwin`
   - Linux (x86_64): `jphw-x86_64-unknown-linux-gnu`
   - Windows: `jphw-x86_64-pc-windows-msvc.exe`
3. Optional: verify integrity using the `SHA256SUMS` file
   (`sha256sum -c SHA256SUMS`).
4. Make the binary executable if required:
   ```bash
   chmod +x ./jphw-*
   ```
5. Move it onto your `PATH` or run it from its current directory.

## 2. Start the Answer Server

By default the CLI sends requests to the hosted server at
`https://zagori.crabdance.com`, which already talks to OpenRouter and caches
responses. If you prefer to self-host, start the bundled Deno server as shown
below. The server supports HTTPS when provided with certificate paths.

```bash
# macOS & Linux
deno task dev:server

# Windows (PowerShell)
deno task dev:server
```

Set the following environment variables before launching:

- `OPENROUTER_API_KEY` – required
- `PORT` (default `8000`)
- `HOST` (default `0.0.0.0`)
- `SERVER_URL` if you host the server elsewhere
- `TLS_CERT_FILE` and `TLS_KEY_FILE` – absolute or relative paths to your TLS
  certificate and private key to enable HTTPS

The server persists cached answers in `apps/server/data/cache.json` so repeated
questions return instantly.

## 3. Run the CLI

Launch the automation against a Google Form:

```bash
./jphw-x86_64-unknown-linux-gnu https://forms.gle/your-form-id
```

Append `--firefox` to target Firefox instead of Chromium.

The CLI will:

1. Prompt for your email, class, student ID, and name on first run and store
   them under `~/.jphw/credentials.json`.
2. Launch Chromium (or Firefox when `--firefox` is supplied) and wait for the
   form to load.
3. Autofill known profile fields, request answers from the server in batches,
   and populate each question.
4. Pause before navigating to the next page or submitting, giving you a chance
   to confirm.

### Common Options

- `--server <url>` – override the API server (defaults to
  `https://zagori.crabdance.com`)
- `--headless` – run the browser without a window (useful on CI)
- `--firefox` – switch the automation from Chromium to Firefox
- `--profile <dir>` – reuse an existing browser profile directory

### Windows Tips

- Rename the downloaded file to `jphw.exe` for easier invocation.
- When running from PowerShell, prepend `./` if the binary isn’t on your `PATH`.

## 4. Keeping Things Updated

- New releases include prebuilt binaries; download and replace your local copy
  when upgrades land.
- Developers can rebuild locally with `deno task build:cli` (artifacts land in
  `dist/`).
- Clear the cache (`apps/server/data/cache.json`) if answers become stale.

## Troubleshooting

- **No questions detected**: ensure Firefox has finished rendering. The CLI
  waits for headings to load; slow networks may take a moment.
- **OpenRouter errors**: confirm your API key is valid and you haven’t hit rate
  limits.
- **Playwright issues**: delete `~/.jphw/firefox-profile` to let the CLI
  recreate a clean profile.

Happy studying! 🎓
