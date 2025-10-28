import type { MessagesContent, QuestionPayload } from "@jphw/types";

export interface OpenRouterOptions {
  model?: string;
  endpoint?: string;
}

export interface AnswerResult {
  answer: string;
  answerIndex?: number;
  extractedText?: string;
}

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";

export class OpenRouterClient {
  #apiKey: string;
  #endpoint: string;
  #model: string;

  constructor(options: OpenRouterOptions = {}) {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    this.#apiKey = apiKey;
    this.#endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const model = Deno.env.get("OPENROUTER_MODEL");
    this.#model = model ?? options.model ?? DEFAULT_MODEL;
  }

  async answer(
    question: QuestionPayload,
    signal?: AbortSignal,
  ): Promise<AnswerResult> {
    // First, extract text from images if they appear to be text-only
    let extractedText: string | undefined;
    if (question.imageUrls.length > 0) {
      extractedText = await this.#extractTextFromImages(
        question.imageUrls,
        signal,
      );
    }

    const response = await fetch(this.#endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#apiKey}`,
        "HTTP-Referer": "https://github.com/dvtzoe/japanese-homework",
        "X-Title": "Japanese Homework",
      },
      body: JSON.stringify({
        model: this.#model,
        messages: [
          {
            role: "system",
            content:
              "You are assisting with filling a google form. Provide concise answers in the exact format user want for direct Google Form submissions.",
          },
          {
            role: "user",
            content: buildPrompt(question, extractedText),
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter request failed: ${response.status} ${errorText}`,
      );
    }

    const payload = (await response.json()) as {
      choices: Array<{ message: { content?: string } }>;
    };

    const choice = payload.choices?.[0]?.message?.content;
    if (!choice) {
      throw new Error("OpenRouter returned an empty response");
    }

    const answer = choice.trim();

    // Parse answer index if it's a choice-based question
    let answerIndex: number | undefined;
    if (question.choices && question.choices.length > 0) {
      const indexMatch = answer.match(/^(\d+)/);
      if (indexMatch) {
        answerIndex = parseInt(indexMatch[1], 10);
      }
    }

    return {
      answer,
      answerIndex,
      extractedText,
    };
  }

  async #extractTextFromImages(
    imageUrls: string[],
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    // Ask the LLM to extract text from images if they're text-only
    const response = await fetch(this.#endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#apiKey}`,
        "HTTP-Referer": "https://github.com/dvtzoe/japanese-homework",
        "X-Title": "Japanese Homework",
      },
      body: JSON.stringify({
        model: this.#model,
        messages: [
          {
            role: "system",
            content:
              "You are extracting text from images. If the image contains ONLY text and nothing else (no diagrams, charts, or other visual elements), extract and return the text exactly as it appears. If the image contains other elements besides text, or if text is not the primary focus, return 'NOT_TEXT_ONLY'.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the text from this image if it's text-only:",
              },
              ...imageUrls.map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
            ],
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      console.warn("Failed to extract text from images");
      return undefined;
    }

    const payload = (await response.json()) as {
      choices: Array<{ message: { content?: string } }>;
    };

    const extracted = payload.choices?.[0]?.message?.content?.trim();
    if (extracted && extracted !== "NOT_TEXT_ONLY") {
      return extracted;
    }

    return undefined;
  }
}

function buildPrompt(
  question: QuestionPayload,
  extractedText?: string,
): MessagesContent {
  const lines: string[] = [];

  if (extractedText) {
    lines.push(`Extracted text from image: ${extractedText}`);
    lines.push("");
  }

  lines.push(`Question: ${question.text.trim()}`);

  if (question.choices && question.choices.length > 0) {
    lines.push("Choices:");
    lines.push(
      ...question.choices.map((choice, index) => {
        const label = String.fromCharCode(49 + index);
        return `${label}. ${choice}`;
      }),
    );
    lines.push(
      "Respond with ONLY the index of choice number that best answers the question.",
    );
  } else {
    lines.push("Respond with the concise text that best answers the question.");
  }

  const content: MessagesContent = [{ type: "text", text: lines.join("\n") }];

  if (question.imageUrls.length > 0) {
    for (const url of question.imageUrls) {
      content.push({ type: "image_url", image_url: { url: url } });
    }
  }

  return content;
}
