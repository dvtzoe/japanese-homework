# Japanese Homework

`jphw` automates the massive amount of Japanese Homework at Kosen KMITL

## Installation

### Precompiled binary

1. Visit the latest GitHub Release for this repository.
2. Download the binary that matches your platform and ends with `-with-browser`
   so you don't have to manually downlaod the browser:
   - macOS (Intel): `jphw-x86_64-apple-darwin`
   - macOS (Apple Silicon): `jphw-aarch64-apple-darwin`
   - Linux (x86_64): `jphw-x86_64-unknown-linux-gnu`
   - Windows: `jphw-x86_64-pc-windows-msvc.exe`
3. Extracts the file
4. Execute the executable

### Manual (Recommended)

#### Prerequisite

1. [`git`](https://git-scm.com/)
2. [`deno`](https://deno.com/)

Clone the repository and enters it

```sh
git clone https://github.com/dvtzoe/japanese-homework.git
cd japanese-homework
```

Install Playwright browsers

```sh
deno run -A npm:playwright install

# optionally specify a browser

deno run -A npm:playwright install firefox

# or if you prefer npx

npx playwright install
```

Run the cli

```sh
deno start
# or
deno start:cli
```

## 2. Start the Answer Server

By default the CLI sends requests to the hosted server at
`https://jphw.crabdance.com`, which already talks to OpenRouter and caches
responses. If you prefer to self-host, start the bundled Deno server as shown
below. The server supports HTTPS when provided with certificate paths.

**Note:** The server now uses PostgreSQL for caching instead of JSON files. See
[apps/server/POSTGRES_SETUP.md](apps/server/POSTGRES_SETUP.md) for detailed
setup instructions.

```sh
deno task start:server
```

Set the following environment variables before launching:

- `DATABASE_URL` – required, PostgreSQL connection string (e.g.,
  `postgresql://user:password@localhost:5432/jphw`)
- `OPENROUTER_API_KEY` – required
- `OPENROUTER_MODEL` - The llm model that will be used
- `PORT` (default `8000`)
- `TLS_CERT_FILE` and `TLS_KEY_FILE` – absolute or relative paths to your TLS
  certificate and private key to enable HTTPS

The server persists cached answers in a PostgreSQL database so repeated
questions return instantly.

### Options

- `--server <url>` – override the API server (defaults to
  `https://jphw.crabdance.com`)
- `--headless` – run the browser without a window (useful on CI)
- `--firefox` – switch the automation from Chromium to Firefox
- `--profile <dir>` – reuse an existing browser profile directory
