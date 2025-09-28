import { Command } from "commander";
import inquirer from "inquirer";

import client, { type Credentials } from "@jphw/client";
import { ensureDir } from "@std/fs";
import { dirname, resolve } from "@std/path";
import { homedir } from "node:os";

const program = new Command();

const CREDENTIALS_PATH = resolve(homedir(), ".jphw", "credentials.json");

program
  .name("jphw")
  .description("Do Japanese homework")
  .version("0.0.0")
  .argument("[url]", "URL of the form")
  .option(
    "--server <url>",
    "Server base URL",
    Deno.env.get("SERVER_URL") ?? "https://zagori.crabdance.com:8443",
  )
  .option("--headless", "Run the browser in headless mode", false)
  .option("--firefox", "Use Firefox instead of Chromium", false)
  .option(
    "--profile <dir>",
    "Persistent browser profile directory",
  )
  .action(async (
    url: string | undefined,
    options: {
      server: string;
      headless?: boolean;
      firefox?: boolean;
      profile?: string;
    },
  ) => {
    let targetUrl = url;
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
        onConfirmNext: () => confirmPrompt("Go to the next page?"),
        onConfirmSubmit: () => confirmPrompt("Submit the form now?"),
        onConfirmClose: () => confirmPrompt("Close the browser window?"),
      });
    } catch (error) {
      console.error("Failed to complete the form:", error);
      Deno.exit(1);
    }
  });

await program.parseAsync(Deno.args);

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
  return Boolean(value) && typeof value === "object" &&
    typeof (value as { email?: unknown }).email === "string" &&
    typeof (value as { class?: unknown }).class === "string" &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { name?: unknown }).name === "string";
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
