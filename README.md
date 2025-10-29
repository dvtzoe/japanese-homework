# Japanese Homework

`jphw` automates the massive amount of Japanese Homework at Kosen KMITL

## Installation

### Quick Instal

The easiest way to install `jphw` is using a single command:

#### Unix-like systems (Linux, macOS)

```sh
curl -fsSL https://raw.githubusercontent.com/dvtzoe/japanese-homework/main/install-remote.sh | bash
```

Or clone and install manually:

```sh
git clone https://github.com/dvtzoe/japanese-homework.git
cd japanese-homework
./install.sh
```

After installation, you can run `jphw` from anywhere:

```sh
jphw --help
jphw https://your-homework-url.com
```

To update to the latest version:

```sh
jphw update
```

To uninstall:

```sh
cd japanese-homework
./uninstall.sh
```

#### Windows

Clone and install:

```cmd
git clone https://github.com/dvtzoe/japanese-homework.git
cd japanese-homework
install.bat
```

After installation, you can run `jphw` from anywhere:

```cmd
jphw --help
jphw https://your-homework-url.com
```

To update to the latest version:

```cmd
jphw update
```

To uninstall:

```cmd
cd japanese-homework
uninstall.bat
```

### Manual Installation

#### Prerequisites

1. [`git`](https://git-scm.com/)
2. [`deno`](https://deno.com/)

Clone the repository and enter it:

```sh
git clone https://github.com/dvtzoe/japanese-homework.git
cd japanese-homework
```

Install Playwright browsers:

```sh
deno run -A npm:playwright install

# optionally specify a browser

deno run -A npm:playwright install firefox

# or if you prefer npx

npx playwright install
```

Run the CLI:

```sh
deno task start
# or
deno task start:cli
```

### Options

- `--server <url>` – override the API server (defaults to
  `https://jphw.crabdance.com`)
- `--headless` – run the browser without a window (useful on CI)
- `--firefox` – switch the automation from Chromium to Firefox
- `--profile <dir>` – reuse an existing browser profile directory

## 2. Start the Answer Server

By default the CLI sends requests to the hosted server at
`https://jphw.crabdance.com`, which already talks to OpenRouter and caches
responses. If you prefer to self-host, start the bundled Deno server as shown
below. The server supports HTTPS when provided with certificate paths.

**Note:** The server now uses PostgreSQL for caching instead of JSON files. See
[apps/server/POSTGRES_SETUP.md](apps/server/POSTGRES_SETUP.md) for detailed
setup instructions. The table will be created automatically on first run.

```sh
deno task start:server
```

Set the following environment variables before launching:

- `DATABASE_URL` – required, PostgreSQL connection string (e.g.,
  `your_user:password@localhost:5432/jphw`)
- `OPENROUTER_API_KEY` – required
- `OPENROUTER_MODEL` - The llm model that will be used
- `PORT` (default `8000`)
- `TLS_CERT_FILE` and `TLS_KEY_FILE` – absolute or relative paths to your TLS
  certificate and private key to enable HTTPS

The server persists cached answers in a PostgreSQL database so repeated
questions return instantly. The cache table is created automatically on startup.
