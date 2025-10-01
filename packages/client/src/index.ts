import { type BrowserContext, chromium, firefox } from "playwright";
import handleBrowsers from "./browsers.ts";
import {
  applyAnswer,
  autoFillQuestion,
  toggleEmailOptions,
  truncate,
} from "./autofill.ts";
import { ensureProfileDir } from "./profile.ts";
import { collectQuestions } from "./questions.ts";
import { requestAnswers } from "./server.ts";
import type { ClientOptions, QuestionContext } from "./types.ts";
export type { ClientOptions, Credentials } from "./types.ts";
import { resolve } from "@std/path";
import { homedir } from "node:os";
import { ensureDir } from "@std/fs";

const DEFAULT_SERVER_URL = Deno.env.get("SERVER_URL") ??
  "https://jphw.crabdance.com";

const DEFAULT_BROWSER: "chromium" | "firefox" = "chromium";

const ENV_PROFILE_DIR = Deno.env.get("PLAYWRIGHT_PROFILE_DIR");

const DEFAULT_PROFILE_DIRS: Record<typeof DEFAULT_BROWSER | "firefox", string> =
  {
    chromium: resolve(homedir(), ".jphw", "chromium-profile"),
    firefox: resolve(homedir(), ".jphw", "firefox-profile"),
  };

export default async function client(options: ClientOptions): Promise<void> {
  const serverUrl = options.serverUrl ?? DEFAULT_SERVER_URL;
  const headless = options.headless ?? false;
  const browser = options.browser ?? DEFAULT_BROWSER;
  const profileDirInput = options.profileDir ??
    ENV_PROFILE_DIR ??
    DEFAULT_PROFILE_DIRS[browser];
  const profileDir = await ensureProfileDir(profileDirInput);
  const credentials = options.credentials;

  await handleBrowsers();

  let context: BrowserContext | null = null;
  try {
    console.log(`Using ${browser} profile at ${profileDir}`);
    try {
      context = browser === "firefox"
        ? await firefox.launchPersistentContext(profileDir, {
          headless,
        })
        : await chromium.launchPersistentContext(profileDir, {
          headless,
          args: ["--disable-blink-features=AutomationControlled"],
        });
    } catch (error) {
      console.error(
        "Try running `npx playwright install` or `deno run -A npm:playright install` to install missing browsers.",
      );
      throw error;
    }
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    console.log(`Navigating to ${options.url}`);
    await page.goto(options.url, { waitUntil: "networkidle" });

    let pageIndex = 0;

    while (true) {
      await toggleEmailOptions(page);
      const questions = await collectQuestions(page);
      console.log(
        `Detected ${questions.length} questions on page ${pageIndex + 1}`,
      );

      const pending: QuestionContext[] = [];

      for (const question of questions) {
        if (credentials && await autoFillQuestion(question, credentials)) {
          continue;
        }

        if (question.payload.type === "unknown") {
          console.log(
            `Skipping question with unknown type: ${
              truncate(question.payload.text)
            }`,
          );
          continue;
        }

        pending.push(question);
      }

      if (pending.length > 0) {
        console.log(`Requesting ${pending.length} answer(s) from server...`);
        const answers = await requestAnswers(
          serverUrl,
          pending.map((item) => item.payload),
        );

        for (let index = 0; index < pending.length; index += 1) {
          const question = pending[index];
          const answer = answers[index];
          console.log(`Answer → ${truncate(answer)}`);
          await applyAnswer(question, answer);
        }
      }

      const nextButton = page.getByRole("button", { name: /next/i });
      if (await nextButton.count()) {
        const proceed = options.onConfirmNext
          ? await options.onConfirmNext({
            pageIndex,
            questionCount: questions.length,
          })
          : true;

        if (!proceed) {
          console.log("Next page navigation cancelled by user.");
          break;
        }

        console.log("Advancing to next page...");
        await nextButton.first().click();
        await page.waitForLoadState("networkidle");
        pageIndex += 1;
        continue;
      }

      const submitButton = page.getByRole("button", { name: /submit/i });

      if (await submitButton.count()) {
        const proceed = options.onConfirmSubmit
          ? await options.onConfirmSubmit({
            pageIndex,
            questionCount: questions.length,
          })
          : true;

        if (!proceed) {
          console.log("Submission cancelled by user.");
          break;
        }

        console.log("Submitting form...");
        await submitButton.first().click();
        await page.waitForLoadState("networkidle").catch(() => {});
        console.log("Form submitted.");
      }

      await page.waitForSelector("text=Your response has been recorded").catch(
        () => {},
      );
      await page.waitForLoadState("networkidle").catch(() => {});

      const viewScoreButton = page.locator('[aria-label="View score"]');

      if (await viewScoreButton.count()) {
        console.log("Detected 'View Score' button, clicking it...");
        await viewScoreButton.first().click();
        await page.waitForLoadState("networkidle").catch(() => {});
        if (options.screenshotPath) {
          ensureDir(options.screenshotPath).catch(() => {});
        }
        await page.screenshot({
          path: options.screenshotPath
            ? resolve(options.screenshotPath, `${Date.now()}.png`)
            : resolve(homedir(), ".jphw", "screenshot", `${Date.now()}.png`),
        });
      }

      const close = options.onConfirmClose
        ? await options.onConfirmClose()
        : true;

      if (close) {
        console.log("Closing browser...");
        break;
      } else {
        console.log("Leaving browser open per user request.");
        return;
      }
    }
  } finally {
    await context?.close();
  }
}
