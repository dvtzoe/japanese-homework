import type {
  AnswerBatchResponse,
  AnswerRequest,
  AnswerResponse,
  QuestionKind,
  QuestionPayload,
} from "@jphw/types";

import { PersistentCache } from "./cache.ts";
import { OpenRouterClient } from "./openrouter.ts";
import { hashImagesFromUrls } from "./image_hash.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8000);
const HOSTNAME = Deno.env.get("HOST") ?? "0.0.0.0";

const TLS_CERT_FILE = Deno.env.get("TLS_CERT_FILE");
const TLS_KEY_FILE = Deno.env.get("TLS_KEY_FILE");

const tlsEnabled = Boolean(TLS_CERT_FILE && TLS_KEY_FILE);

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

// function canonicalizeQuestion(question: QuestionPayload) {
// 	const trimmedChoices = question.choices
// 		?.map((choice) => choice.trim())
// 		.filter((choice) => choice.length > 0)
// 		.sort();
//
// 	return {
// 		text: question.text.trim().toLowerCase(),
// 		images: question.imageUrls
// 			.map((url) => url.trim())
// 			.filter((url) => url.length > 0)
// 			.sort(),
// 		choices:
// 			trimmedChoices && trimmedChoices.length > 0 ? trimmedChoices : undefined,
// 		type: question.type,
// 	};
// }
//
// async function computeCacheKey(question: QuestionPayload): Promise<string> {
//   const canonical = canonicalizeQuestion(question);
//   const payload = JSON.stringify(canonical);
//   const data = new TextEncoder().encode(payload);
//   const digest = await crypto.subtle.digest("SHA-256", data);
//   const bytes = new Uint8Array(digest);
//
//   let result = "";
//   for (const byte of bytes) {
//     result += byte.toString(16).padStart(2, "0");
//   }
//   return result;
// }

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
  // Hash images if present
  const imageHash = question.imageUrls.length > 0
    ? await hashImagesFromUrls(question.imageUrls)
    : undefined;

  // Try to find cached answer using question details
  const cached = await cache.get(question.text, imageHash, question.choices);
  if (cached) {
    return cached.answer;
  }

  const client = getRouterClient();
  const result = await client.answer(question);

  // Store in cache with all relevant details
  await cache.set({
    answer: result.answer,
    answer_index: result.answerIndex,
    question: question.text,
    image_hash: imageHash,
    extracted_text: result.extractedText,
    choices: question.choices,
  });

  return result.answer;
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

async function handleSearch(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const question = url.searchParams.get("question") ?? undefined;
    const imageHash = url.searchParams.get("image_hash") ?? undefined;
    const choicesParam = url.searchParams.get("choices");
    const choices = choicesParam ? JSON.parse(choicesParam) : undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const results = await cache.search({
      question,
      image_hash: imageHash,
      choices,
      limit,
      offset,
    });

    return json({ results, count: results.length }, { status: 200 });
  } catch (error) {
    console.error("Search failure", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, { status: 400 });
  }
}

const serveOptionsBase = {
  port: PORT,
  hostname: HOSTNAME,
  onListen: ({ port, hostname }: { port: number; hostname: string }) => {
    const protocol = tlsEnabled ? "https" : "http";
    console.log(`Server listening on ${protocol}://${hostname}:${port}`);
  },
} as const;

let serveOptions:
  | (typeof serveOptionsBase & { cert: string; key: string })
  | typeof serveOptionsBase;

if (tlsEnabled) {
  try {
    const [cert, key] = await Promise.all([
      Deno.readTextFile(TLS_CERT_FILE!),
      Deno.readTextFile(TLS_KEY_FILE!),
    ]);
    serveOptions = { ...serveOptionsBase, cert, key };
  } catch (error) {
    console.error("Failed to read TLS certificate or key:", error);
    Deno.exit(1);
  }
} else {
  serveOptions = serveOptionsBase;
}

if (!tlsEnabled && (TLS_CERT_FILE || TLS_KEY_FILE)) {
  console.warn(
    "Both TLS_CERT_FILE and TLS_KEY_FILE must be set to enable HTTPS; serving over HTTP instead.",
  );
}

Deno.serve(serveOptions, async (request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    return json({ status: "ok" }, { headers: corsHeaders() });
  }

  if (request.method === "GET" && url.pathname === "/search") {
    const response = await handleSearch(request);
    return withCors(response);
  }

  if (request.method === "POST" && url.pathname === "/answers") {
    const response = await handleBatchAnswers(request);
    return withCors(response);
  }

  if (request.method === "POST" && url.pathname === "/answer") {
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

// Graceful shutdown
Deno.addSignalListener("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await cache.disconnect();
  Deno.exit(0);
});

Deno.addSignalListener("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  await cache.disconnect();
  Deno.exit(0);
});
