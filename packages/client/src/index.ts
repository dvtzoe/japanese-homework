import { type BrowserContext, firefox } from "playwright";

import { applyAnswer, autoFillQuestion, truncate } from "./autofill.ts";
import { ensureProfileDir } from "./profile.ts";
import { collectQuestions } from "./questions.ts";
import { requestAnswers } from "./server.ts";
import type { ClientOptions, QuestionContext } from "./types.ts";
export type { ClientOptions, Credentials } from "./types.ts";
import { resolve } from "@std/path";
import { homedir } from "node:os";

const DEFAULT_SERVER_URL = Deno.env.get("SERVER_URL") ??
  "https://zagori.crabdance.com";
const DEFAULT_PROFILE_DIR = Deno.env.get("PLAYWRIGHT_PROFILE_DIR") ??
  resolve(homedir(), ".jphw", "firefox-profile");

export default async function client(options: ClientOptions): Promise<void> {
  const serverUrl = options.serverUrl ?? DEFAULT_SERVER_URL;
  const headless = options.headless ?? false;
  const profileDir = await ensureProfileDir(
    options.profileDir ?? DEFAULT_PROFILE_DIR,
  );
  const credentials = options.credentials;

  let context: BrowserContext | null = null;
  try {
    console.log(`Using Firefox profile at ${profileDir}`);
    context = await firefox.launchPersistentContext(profileDir, { headless });
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    console.log(`Navigating to ${options.url}`);
    await page.goto(options.url, { waitUntil: "networkidle" });

    let pageIndex = 0;

    while (true) {
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

      break;
    }
  } finally {
    await context?.close();
  }
}
