import type {
  AnswerBatchResponse,
  AnswerRequest,
  AnswerResponse,
  QuestionKind,
  QuestionPayload,
} from "@jphw/types";

import { PersistentCache } from "./cache.ts";
import { OpenRouterClient } from "./openrouter.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8000);
const cache = new PersistentCache();
await cache.init();

let routerClient: OpenRouterClient | null = null;

function getRouterClient(): OpenRouterClient {
  if (!routerClient) {
    routerClient = new OpenRouterClient();
  }
  return routerClient;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers,
  });
}

function canonicalizeQuestion(question: QuestionPayload) {
  const trimmedChoices = question.choices?.map((choice) => choice.trim())
    .filter((choice) => choice.length > 0)
    .sort();

  return {
    text: question.text.trim().toLowerCase(),
    images: question.imageUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .sort(),
    choices: trimmedChoices && trimmedChoices.length > 0
      ? trimmedChoices
      : undefined,
    type: question.type,
  };
}

async function computeCacheKey(question: QuestionPayload): Promise<string> {
  const canonical = canonicalizeQuestion(question);
  const payload = JSON.stringify(canonical);
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);

  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }
  return result;
}

function normalizeType(value: unknown): QuestionKind {
  const valid: QuestionKind[] = [
    "short_answer",
    "radio",
    "dropdown",
    "unknown",
  ];
  if (typeof value === "string" && valid.includes(value as QuestionKind)) {
    return value as QuestionKind;
  }
  return "unknown";
}

function parseQuestionPayload(raw: unknown): QuestionPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Missing question payload");
  }

  const text = String((raw as { text?: unknown }).text ?? "").trim();
  if (!text) {
    throw new Error("Question text is required");
  }

  const imageValues = (raw as { imageUrls?: unknown }).imageUrls;
  const imageUrls = Array.isArray(imageValues)
    ? imageValues
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)
    : [];

  const choicesRaw = (raw as { choices?: unknown }).choices;
  const choices = Array.isArray(choicesRaw)
    ? choicesRaw
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)
    : undefined;

  const type = normalizeType((raw as { type?: unknown }).type);

  return {
    text,
    imageUrls,
    choices,
    type,
  };
}

function parseRequest(payload: unknown): AnswerRequest {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be an object");
  }

  const question = (payload as { question?: unknown }).question;
  if (question === undefined) {
    throw new Error("Missing question payload");
  }

  return {
    question: parseQuestionPayload(question),
  } satisfies AnswerRequest;
}

function parseBatchRequest(payload: unknown): QuestionPayload[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be an object");
  }

  const questionsValue = (payload as { questions?: unknown }).questions;
  if (!Array.isArray(questionsValue)) {
    throw new Error("'questions' must be an array");
  }

  if (questionsValue.length === 0) {
    throw new Error("'questions' array cannot be empty");
  }

  return questionsValue.map((question, index) => {
    try {
      return parseQuestionPayload(question);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Question ${index}: ${error.message}`);
      }
      throw error;
    }
  });
}

async function answerQuestion(question: QuestionPayload): Promise<string> {
  const cacheKey = await computeCacheKey(question);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached.answer;
  }

  const client = getRouterClient();
  const answer = await client.answer(question);
  await cache.set(cacheKey, answer);
  return answer;
}

async function handleAnswer(request: Request): Promise<Response> {
  let parsed: AnswerRequest;
  try {
    const body = await request.json();
    parsed = parseRequest(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return json({ error: message }, { status: 400 });
  }

  try {
    const answer = await answerQuestion(parsed.question);
    const payload: AnswerResponse = { answer };
    return json(payload, { status: 200 });
  } catch (error) {
    console.error("OpenRouter failure", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, { status: 502 });
  }
}

async function handleBatchAnswers(request: Request): Promise<Response> {
  let parsed: QuestionPayload[];
  try {
    const body = await request.json();
    parsed = parseBatchRequest(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return json({ error: message }, { status: 400 });
  }

  try {
    const answers = await Promise.all(
      parsed.map((question) => answerQuestion(question)),
    );
    const payload: AnswerBatchResponse = { answers };
    return json(payload, { status: 200 });
  } catch (error) {
    console.error("OpenRouter failure", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, { status: 502 });
  }
}

Deno.serve({
  port: PORT,
  hostname: Deno.env.get("HOST") ?? "0.0.0.0",
  onListen: ({ port, hostname }) => {
    console.log(`Server listening on http://${hostname}:${port}`);
  },
}, async (request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method === "GET" && url.pathname === "/jphw/health") {
    return json({ status: "ok" }, { headers: corsHeaders() });
  }

  if (request.method === "POST" && url.pathname === "/jphw/answers") {
    const response = await handleBatchAnswers(request);
    return withCors(response);
  }

  if (request.method === "POST" && url.pathname === "/jphw/answer") {
    const response = await handleAnswer(request);
    return withCors(response);
  }

  return json({ error: "Not found" }, { status: 404, headers: corsHeaders() });
});

function withCors(response: Response): Response {
  const cors = corsHeaders();
  for (const [key, value] of cors) {
    response.headers.set(key, value);
  }
  return response;
}

function corsHeaders(): Headers {
  return new Headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
}
