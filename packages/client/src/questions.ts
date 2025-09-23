import type { Page } from "playwright";

import type { QuestionPayload } from "@jphw/types";

import type { QuestionContext } from "./types.ts";

export async function collectQuestions(page: Page): Promise<QuestionContext[]> {
  try {
    await page.waitForSelector('[role="listitem"]', { timeout: 5000 });
  } catch {
    // No questions available on this page.
  }

  const locator = page.locator('[role="listitem"]');
  const count = await locator.count();
  const result: QuestionContext[] = [];

  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    const text =
      (await item.locator('[role="heading"]')?.textContent())?.trim() ??
        "";
    const images = await item.locator("img").all().then(
      async (imgs) =>
        await Promise.all(
          imgs.map(async (img) => await img.getAttribute("src")),
        ),
    ).then(
      (srcs) => srcs.filter((src): src is string => Boolean(src)),
    );

    const radios = await item.locator('[role="radio"]').all();
    const dropdown = item.locator("[role=listbox]");
    const shortInput = item.locator('input[type="text"]');

    let type: QuestionPayload["type"] = "unknown";
    let choices: string[] | undefined;

    if (radios.length > 0) {
      type = "radio";
      choices = await Promise.all(
        radios
          .map(async (node) => {
            return (await node.locator("../..").textContent())?.trim() ?? "";
          })
          .filter(async (choice) => (await choice).length > 0),
      );
    } else if (await dropdown.count() > 0) {
      type = "dropdown";
      choices = await Promise.all(
        (await dropdown.locator("[role='option']").all())
          .map(async (node) => (await node.textContent())?.trim() ?? "")
          .filter(async (choice) => (await choice).length > 0),
      );
    } else if (await shortInput.count() > 0) {
      type = "short_answer";
    }

    const payload = {
      text,
      imageUrls: images,
      choices,
      type,
    } satisfies QuestionPayload;

    if (!payload.text) {
      continue;
    }

    result.push({ payload, locator: item });
  }

  return result;
}
