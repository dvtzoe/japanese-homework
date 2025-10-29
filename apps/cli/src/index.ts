import { Command } from "commander";
import inquirer from "inquirer";

import client, { type Credentials } from "@jphw/client";
import { ensureDir } from "@std/fs";
import { dirname, resolve } from "@std/path";
import { homedir } from "node:os";

const program = new Command();

const CREDENTIALS_PATH = resolve(homedir(), ".jphw", "credentials.json");
const VERSION_CHECK_FILE = resolve(homedir(), ".jphw", "version-check.json");
const VERSION = "0.1.0";

// Version check interval (24 hours)
const VERSION_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

program
  .name("jphw")
  .description("Do Japanese homework")
  .version(VERSION)
  .argument("[url]", "URL of the form")
  .option(
    "--server <url>",
    "Server base URL",
    Deno.env.get("SERVER_URL") ?? "https://jphw.crabdance.com",
  )
  .option("--headless", "Run the browser in headless mode", false)
  .option("--firefox", "Use Firefox instead of Chromium", false)
  .option("--profile <dir>", "Persistent browser profile directory")
  .option("-y, --yes", "Skip confirmation prompts except submission", false)
  .option(
    "-Y, --yes-all",
    "Skip all confirmation prompts including submission",
    false,
  )
  .option(
    "--screenshot <path>",
    "Take a screenshot after submission and save to the given path",
  )
  .option(
    "--skip-update-check",
    "Skip checking for updates",
    false,
  );

// Add update command
program
  .command("update")
  .description("Update jphw to the latest version")
  .action(async () => {
    await updateJphw();
    Deno.exit(0);
  });

program.parse();

const options = program.opts();

// Check for updates (unless skipped or running update command)
if (!options.skipUpdateCheck && program.args[0] !== "update") {
  await checkForUpdates().catch(() => {
    // Silently fail update check
  });
}

const urlArg = program.args[0];
if (urlArg) {
  options.url = urlArg;
}

let targetUrl = options.url;
if (!targetUrl) {
  const answers = await inquirer.prompt<{ url: string }>([
    {
      type: "input",
      name: "url",
      message: "Please enter the URL of the form:",
    },
  ]);
  targetUrl = answers.url;
}

if (!targetUrl) {
  console.error("A Google Form URL is required.");
  Deno.exit(1);
}

const trimmedUrl = targetUrl.trim();
const credentials = await loadCredentials();

try {
  await client({
    url: trimmedUrl,
    serverUrl: options.server,
    headless: Boolean(options.headless),
    browser: options.firefox ? "firefox" : "chromium",
    profileDir: options.profile,
    credentials,
    onConfirmNext: options.yes || options.yesAll
      ? () => Promise.resolve(true)
      : () => confirmPrompt("Proceed to the next page?"),
    onConfirmSubmit: options.yesAll
      ? () => Promise.resolve(true)
      : () => confirmPrompt("Submit the form?"),
    onConfirmClose: options.yesAll
      ? () => Promise.resolve(true)
      : () => confirmPrompt("Close the browser?"),
    screenshotPath: options.screenshot ? options.screenshot.trim() : undefined,
  });
} catch (error) {
  console.error("Failed to complete the form:", error);
  Deno.exit(1);
}

async function confirmPrompt(message: string): Promise<boolean> {
  const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
    {
      type: "confirm",
      name: "proceed",
      message,
      default: true,
    },
  ]);
  return proceed;
}

async function loadCredentials(): Promise<Credentials> {
  try {
    const raw = await Deno.readTextFile(CREDENTIALS_PATH);
    const parsed = JSON.parse(raw);
    if (isCredentialShape(parsed)) {
      console.log(`Loaded credentials from ${CREDENTIALS_PATH}`);
      return parsed;
    }
    console.warn("Stored credentials are incomplete; re-entering information.");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(
        "Failed to read saved credentials, re-entering information.",
      );
    }
  }

  const credentials = await promptForCredentials();
  await persistCredentials(credentials);
  return credentials;
}

function isCredentialShape(value: unknown): value is Credentials {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { email?: unknown }).email === "string" &&
    typeof (value as { class?: unknown }).class === "string" &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

async function promptForCredentials(): Promise<Credentials> {
  const answers = await inquirer.prompt<Credentials>([
    {
      type: "input",
      name: "email",
      message: "Email address:",
      validate: (input: string) => input.includes("@") || "Enter a valid email",
    },
    {
      type: "list",
      name: "class",
      message: "Class (department + room):",
      choices: ["M1", "M2", "C1", "C2", "E1", "E2"],
    },
    {
      type: "input",
      name: "id",
      message: "Student ID:",
      validate: (input: string) => input.trim().length > 0 || "ID is required",
    },
    {
      type: "input",
      name: "name",
      message: "Name (名前):",
      validate: (input: string) =>
        input.trim().length > 0 || "Name is required",
    },
  ]);

  return {
    email: answers.email.trim(),
    class: answers.class.trim().toUpperCase(),
    id: answers.id.trim(),
    name: answers.name.trim(),
  };
}

async function persistCredentials(credentials: Credentials) {
  await ensureDir(dirname(CREDENTIALS_PATH));
  await Deno.writeTextFile(
    CREDENTIALS_PATH,
    JSON.stringify(credentials, null, 2),
  );
  console.log(`Saved credentials to ${CREDENTIALS_PATH}`);
}

// Update checker function
async function checkForUpdates(): Promise<void> {
  try {
    // Check if we've checked recently
    const now = Date.now();
    let lastCheck = 0;

    try {
      const data = await Deno.readTextFile(VERSION_CHECK_FILE);
      const parsed = JSON.parse(data);
      lastCheck = parsed.lastCheck || 0;
    } catch {
      // File doesn't exist, first check
    }

    // Only check once per day
    if (now - lastCheck < VERSION_CHECK_INTERVAL) {
      return;
    }

    // Get the installation directory from the wrapper
    const jphwDir = Deno.env.get("JPHW_DIR");
    if (!jphwDir) {
      return; // Not installed via wrapper, skip update check
    }

    // Check git status
    const gitCheck = new Deno.Command("git", {
      args: ["-C", jphwDir, "fetch", "--dry-run"],
      stdout: "inherit",
      stderr: "inherit",
    });

    await gitCheck.output();

    // Get default branch name dynamically
    const showOrigin = new Deno.Command("git", {
      args: ["-C", jphwDir, "remote", "show", "origin"],
      stdout: "piped",
      stderr: "inherit",
    });

    let defaultBranch = "main";
    try {
      const { stdout: branchStdout } = await showOrigin.output();
      const output = new TextDecoder().decode(branchStdout);
      const match = output.match(/HEAD branch: (.+)/);
      if (match) {
        defaultBranch = match[1].trim();
      }
    } catch {
      // Fallback to main if detection fails
      defaultBranch = "main";
    }

    const gitStatus = new Deno.Command("git", {
      args: [
        "-C",
        jphwDir,
        "rev-list",
        `HEAD...origin/${defaultBranch}`,
        "--count",
      ],
      stdout: "piped",
      stderr: "inherit",
    });

    const { stdout } = await gitStatus.output();
    const decoder = new TextDecoder();
    const count = parseInt(decoder.decode(stdout).trim());

    if (count > 0) {
      console.log(
        `\n⚠️  A new version of jphw is available! Run 'jphw update' to update.\n`,
      );
    }

    // Save last check time
    await ensureDir(dirname(VERSION_CHECK_FILE));
    await Deno.writeTextFile(
      VERSION_CHECK_FILE,
      JSON.stringify({ lastCheck: now }),
    );
  } catch {
    // Silently fail if update check fails
  }
}

// Update function
async function updateJphw(): Promise<void> {
  console.log("Checking for updates...");

  const jphwDir = Deno.env.get("JPHW_DIR");
  if (!jphwDir) {
    console.error(
      "Error: JPHW_DIR environment variable not set. Unable to locate installation directory.",
    );
    console.error("This might happen if jphw was not installed via install.sh");
    Deno.exit(1);
  }

  try {
    // Check if we're in a git repository
    const gitCheck = new Deno.Command("git", {
      args: ["-C", jphwDir, "rev-parse", "--git-dir"],
      stdout: "inherit",
      stderr: "inherit",
    });

    const { code } = await gitCheck.output();
    if (code !== 0) {
      console.error(
        "Error: Installation directory is not a git repository.",
      );
      console.error(
        "Please reinstall jphw using the installation script.",
      );
      Deno.exit(1);
    }

    console.log("Fetching latest changes...");

    // Fetch updates
    const fetchCmd = new Deno.Command("git", {
      args: ["-C", jphwDir, "fetch", "origin"],
    });
    await fetchCmd.output();

    // Get default branch name dynamically
    const showOrigin = new Deno.Command("git", {
      args: ["-C", jphwDir, "remote", "show", "origin"],
      stdout: "piped",
      stderr: "inherit",
    });

    let defaultBranch = "main";
    try {
      const { stdout: branchStdout } = await showOrigin.output();
      const output = new TextDecoder().decode(branchStdout);
      const match = output.match(/HEAD branch: (.+)/);
      if (match) {
        defaultBranch = match[1].trim();
      }
    } catch {
      // Fallback to main if detection fails
      defaultBranch = "main";
    }

    // Check if updates are available
    const revListCmd = new Deno.Command("git", {
      args: [
        "-C",
        jphwDir,
        "rev-list",
        `HEAD...origin/${defaultBranch}`,
        "--count",
      ],
      stdout: "piped",
    });

    const { stdout } = await revListCmd.output();
    const decoder = new TextDecoder();
    const count = parseInt(decoder.decode(stdout).trim());

    if (count === 0) {
      console.log("✓ jphw is already up to date!");
      return;
    }

    console.log(`Found ${count} new commit(s). Updating...`);

    // Reset to detected default branch
    const resetCmd = new Deno.Command("git", {
      args: ["-C", jphwDir, "reset", "--hard", `origin/${defaultBranch}`],
    });
    await resetCmd.output();

    console.log("✓ jphw has been updated successfully!");
    console.log("Run 'jphw --help' to see any new features.");
  } catch (error) {
    console.error("Error updating jphw:", error);
    Deno.exit(1);
  }
}
