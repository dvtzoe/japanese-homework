import type { MessagesContent, QuestionPayload } from "@jphw/types";

export interface OpenRouterOptions {
  model?: string;
  endpoint?: string;
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
  ): Promise<string> {
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
            content: buildPrompt(question),
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

    return choice.trim();
  }
}

function buildPrompt(question: QuestionPayload): MessagesContent {
  const lines = [`Question: ${question.text.trim()}`];

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
