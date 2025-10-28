import type { Locator, Page } from "playwright";

import type { QuestionPayload } from "@jphw/types";

import type { Credentials, QuestionContext } from "./types.ts";

const EMAIL_KEYWORDS = ["email", "mail", "メール"];
const NAME_KEYWORDS = ["name", "名前", "なまえ"];
const ID_KEYWORDS = ["id"];
const CLASS_KEYWORDS = ["class"];

export async function autoFillQuestion(
  question: QuestionContext,
  credentials: Credentials,
): Promise<boolean> {
  const { locator, payload } = question;
  const label = payload.text.toLowerCase();
  const targetClass = canonicalizeClass(credentials.class);

  if (
    matchesKeyword(label, EMAIL_KEYWORDS) ||
    matchesChoices(payload.choices, EMAIL_KEYWORDS)
  ) {
    let handled = false;
    handled = (await fillText(locator, credentials.email)) || handled;
    if (handled) {
      console.log("Auto-filled email field");
      return true;
    }
  }

  if (
    matchesKeyword(label, ID_KEYWORDS) ||
    matchesChoices(payload.choices, ID_KEYWORDS)
  ) {
    if (await fillText(locator, credentials.id)) {
      console.log("Auto-filled ID field");
      return true;
    }
  }

  if (
    matchesKeyword(label, NAME_KEYWORDS) ||
    matchesChoices(payload.choices, NAME_KEYWORDS)
  ) {
    if (await fillText(locator, credentials.name)) {
      console.log("Auto-filled name field");
      return true;
    }
  }

  if (
    (targetClass && matchesKeyword(label, CLASS_KEYWORDS)) ||
    (targetClass && isLikelyClassQuestion(payload, targetClass))
  ) {
    if (targetClass && await fillClass(locator, targetClass)) {
      console.log("Auto-filled class field");
      return true;
    }
  }

  return false;
}

export async function applyAnswer(
  context: QuestionContext,
  rawAnswer: string,
) {
  const { locator, payload } = context;
  let answer: string | number;
  if (typeof Number(rawAnswer) === "number") {
    answer = Number(rawAnswer);
  } else {
    answer = rawAnswer;
  }

  switch (payload.type) {
    case "radio": {
      await selectRadio(locator, <number> answer);
      break;
    }
    case "dropdown": {
      await selectDropdown(locator, <number> answer);
      break;
    }
    case "short_answer": {
      await fillText(locator, <string> answer);
      break;
    }
    default: {
      console.warn(`Unhandled question type '${payload.type}', skipping.`);
    }
  }
}

export function truncate(value: string, length = 80): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > length ? `${trimmed.slice(0, length)}…` : trimmed;
}

async function fillText(locator: Locator, answer: string): Promise<boolean> {
  const input = locator.locator('input[type="text"]');
  if (await input.count()) {
    const element = input.first();
    await element.waitFor({ state: "visible", timeout: 5000 });
    await element.fill(answer);
    // Small delay to allow form state to update
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  const textarea = locator.locator("textarea");
  if (await textarea.count()) {
    const element = textarea.first();
    await element.waitFor({ state: "visible", timeout: 5000 });
    await element.fill(answer);
    // Small delay to allow form state to update
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  console.warn("No text input found for short answer question.");
  return false;
}

async function selectRadio(
  locator: Locator,
  answer: number,
): Promise<boolean> {
  const option = locator.locator("[role='radio']");
  if (await option.count() > 0) {
    const index = answer - 1;
    if (index < 0) {
      console.warn("Radio answer index is less than 1.");
      return false;
    }

    if (index >= await option.count()) {
      console.warn("Radio answer index exceeds available options.");
      return false;
    }

    const element = option.nth(index);
    await element.waitFor({ state: "visible", timeout: 5000 });
    await element.click();
    // Small delay to allow form state to update
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  console.warn("No radio button found for radio question.");
  return false;
}

async function selectDropdown(
  locator: Locator,
  answer: number,
): Promise<boolean> {
  const listbox = locator.locator("[role='listbox']").first();
  await listbox.waitFor({ state: "visible", timeout: 5000 });
  await listbox.click();

  const option = locator.locator("[role='option']");
  await option.first().waitFor({ state: "visible", timeout: 5000 });

  if (await option.count() > 0) {
    const index = answer;
    if (index < 0) {
      console.warn("Dropdown answer index is less than 1.");
      return false;
    }

    if (index >= await option.count()) {
      console.warn("Dropdown answer index exceeds available options.");
      return false;
    }

    // Retry logic with max attempts to prevent infinite loops
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const element = option.nth(index);
        await element.waitFor({ state: "visible", timeout: 2000 });
        await element.click({ timeout: 2000 });
        // Small delay to allow form state to update
        await new Promise((resolve) => setTimeout(resolve, 100));
        return true;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.warn(
            `Failed to click dropdown option after ${maxRetries} attempts`,
          );
          throw error;
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  console.warn("No dropdown select found for dropdown question.");
  return false;
}

function matchesKeyword(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function matchesChoices(
  choices: string[] | undefined,
  keywords: string[],
): boolean {
  if (!choices) {
    return false;
  }
  return choices.some((choice) => matchesKeyword(choice, keywords));
}

export async function toggleEmailOptions(page: Page): Promise<boolean> {
  let handled = false;
  const checkboxes = page.locator('[role="checkbox"]');
  const checkboxCount = await checkboxes.count();
  for (let index = 0; index < checkboxCount; index += 1) {
    const checkbox = checkboxes.nth(index);
    await checkbox.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const alreadyChecked = await checkbox.isChecked().catch(() => false);
    if (!alreadyChecked) {
      await checkbox.click({ force: true });
      // Small delay to allow form state to update
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    handled = true;
  }

  return handled;
}

function isLikelyClassQuestion(
  payload: QuestionPayload,
  targetClass: string,
): boolean {
  if (matchesKeyword(payload.text, CLASS_KEYWORDS)) {
    return true;
  }

  if (!payload.choices || payload.choices.length === 0) {
    return false;
  }

  let canonicalMatches = 0;
  let targetSeen = false;
  for (const choice of payload.choices) {
    const canonical = canonicalizeClass(choice);
    if (canonical) {
      canonicalMatches += 1;
      if (canonical === targetClass) {
        targetSeen = true;
      }
    }
  }

  return targetSeen || canonicalMatches >= 2;
}

async function fillClass(
  locator: Locator,
  targetClass: string,
): Promise<boolean> {
  const radios = locator.getByRole("radio");
  if (await radios.count()) {
    if (await selectClassFromOptions(radios, targetClass)) {
      return true;
    }
  }

  return await fillText(locator, targetClass);
}

async function selectClassFromOptions(
  options: Locator,
  target: string,
): Promise<boolean> {
  const optionCount = await options.count();
  for (let index = 0; index < optionCount; index += 1) {
    const option = options.nth(index).locator("../..");
    await option.waitFor({ state: "visible", timeout: 5000 });
    const label = await option.innerText();
    const canonical = canonicalizeClass(label);
    if (canonical === target) {
      await option.click({ force: true });
      // Small delay to allow form state to update
      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    }
  }
  return false;
}

function canonicalizeClass(value: string): string | null {
  const upper = value.trim().toUpperCase();
  const deptMatch = upper.match(/[MCE]/);
  const roomMatch = upper.match(/[12]/);
  if (!deptMatch || !roomMatch) {
    return null;
  }
  return `${deptMatch[0]}${roomMatch[0]}`;
}
