# Japanese Homework Assistant

`jphw` automates repetitive Google Form drills by launching Firefox, scraping each question, and sending them to an AI-backed server for answers. The project ships as a cross-platform CLI plus a Deno server that proxies OpenRouter. This guide walks through first-time setup on macOS, Linux, and Windows.

## Prerequisites
- An [OpenRouter](https://openrouter.ai/) account and API key
- Firefox installed locally (the CLI drives it through Playwright)
- Deno v1.39+ if you plan to run from source or start the server locally

## 1. Download the CLI
1. Visit the latest GitHub Release for this repository.
2. Download the binary that matches your platform:
   - macOS (Intel): `jphw-x86_64-apple-darwin`
   - macOS (Apple Silicon): `jphw-aarch64-apple-darwin`
   - Linux (x86_64): `jphw-x86_64-unknown-linux-gnu`
   - Windows: `jphw-x86_64-pc-windows-msvc.exe`
3. Optional: verify integrity using the `SHA256SUMS` file (`sha256sum -c SHA256SUMS`).
4. Make the binary executable if required:
   ```bash
   chmod +x ./jphw-*
   ```
5. Move it onto your `PATH` or run it from its current directory.

## 2. Start the Answer Server
The CLI talks to a Deno server that calls OpenRouter and caches responses on disk.

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

The server persists cached answers in `apps/server/data/cache.json` so repeated questions return instantly.

## 3. Run the CLI
Launch the Firefox automation against a Google Form:

```bash
./jphw-x86_64-unknown-linux-gnu https://forms.gle/your-form-id
```

The CLI will:
1. Prompt for your email, class, student ID, and name on first run and store them under `~/.jphw/credentials.json`.
2. Open Firefox (headless mode optional) and wait for the form to load.
3. Autofill known profile fields, request answers from the server in batches, and populate each question.
4. Pause before navigating to the next page or submitting, giving you a chance to confirm.

### Common Options
- `--server <url>` – point to a remote server (defaults to `http://localhost:8000`)
- `--headless` – run Firefox without a window (useful on CI)
- `--profile <dir>` – reuse an existing Firefox profile directory

### Windows Tips
- Rename the downloaded file to `jphw.exe` for easier invocation.
- When running from PowerShell, prepend `./` if the binary isn’t on your `PATH`.

## 4. Keeping Things Updated
- New releases include prebuilt binaries; download and replace your local copy when upgrades land.
- Developers can rebuild locally with `deno task build:cli` (artifacts land in `dist/`).
- Clear the cache (`apps/server/data/cache.json`) if answers become stale.

## Troubleshooting
- **No questions detected**: ensure Firefox has finished rendering. The CLI waits for headings to load; slow networks may take a moment.
- **OpenRouter errors**: confirm your API key is valid and you haven’t hit rate limits.
- **Playwright issues**: delete `~/.jphw/firefox-profile` to let the CLI recreate a clean profile.

Happy studying! 🎓
