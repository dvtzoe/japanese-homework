import type { Locator } from "playwright";

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
    handled = (await toggleEmailOptions(locator)) || handled;
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
    await input.first().fill(answer);
    return true;
  }

  const textarea = locator.locator("textarea");
  if (await textarea.count()) {
    await textarea.first().fill(answer);
    return true;
  }

  console.warn("No text input found for short answer question.");
  return false;
}

async function selectRadio(
  locator: Locator,
  answer: number,
): Promise<boolean> {
  const option = locator.locator("input[type='radio']");
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

    await option.nth(index).click();
    return true;
  }

  console.warn("No radio button found for radio question.");
  return false;
}

async function selectDropdown(
  locator: Locator,
  answer: number,
): Promise<boolean> {
  await locator.locator("[role='listbox']").first().click();
  const option = locator.locator("[role='option']");
  await option.first().waitFor();

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

    const click = async () => {
      try {
        await option.nth(index).click({ timeout: 1000 });
      } catch {
        click();
      }
    };
    await click();

    return true;
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

async function toggleEmailOptions(locator: Locator): Promise<boolean> {
  let handled = false;
  const checkboxes = locator.getByRole("checkbox");
  const checkboxCount = await checkboxes.count();
  for (let index = 0; index < checkboxCount; index += 1) {
    const checkbox = checkboxes.nth(index);
    const alreadyChecked = await checkbox.isChecked().catch(() => false);
    if (!alreadyChecked) {
      await checkbox.click({ force: true });
    }
    handled = true;
  }

  const radios = locator.getByRole("radio");
  const radioCount = await radios.count();
  for (let index = 0; index < radioCount; index += 1) {
    const radio = radios.nth(index);
    const label = await radio.innerText();
    if (matchesKeyword(label, EMAIL_KEYWORDS)) {
      await radio.click({ force: true });
      handled = true;
      break;
    }
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
    const label = await option.innerText();
    const canonical = canonicalizeClass(label);
    if (canonical === target) {
      await option.click({ force: true });
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
