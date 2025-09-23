import type {
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

function buildCacheKey(question: QuestionPayload): string {
  return JSON.stringify({
    text: question.text.trim().toLowerCase(),
    images: question.imageUrls.map((url) => url.trim()),
    choices: [...(question.choices ?? [])].sort()?.map((choice) =>
      choice.trim()
    ),
    type: question.type,
  });
}

function normalizeType(value: unknown): QuestionKind {
  const valid: QuestionKind[] = [
    "short_answer",
    "radio",
    "unknown",
  ];
  if (typeof value === "string" && valid.includes(value as QuestionKind)) {
    return value as QuestionKind;
  }
  return "unknown";
}

function parseRequest(payload: unknown): AnswerRequest {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be an object");
  }

  const question = (payload as { question?: unknown }).question;
  if (!question || typeof question !== "object") {
    throw new Error("Missing question payload");
  }

  const text = String((question as { text?: unknown }).text ?? "").trim();
  if (!text) {
    throw new Error("Question text is required");
  }

  const imageUrls =
    Array.isArray((question as { imageUrls?: unknown }).imageUrls)
      ? ((question as { imageUrls: unknown[] }).imageUrls.map((value) =>
        String(value)
      ))
      : [];

  const choicesRaw = (question as { choices?: unknown }).choices;
  const choices = Array.isArray(choicesRaw)
    ? choicesRaw.map((value) => String(value))
    : undefined;

  const type = normalizeType((question as { type?: unknown }).type);

  return {
    question: {
      text,
      imageUrls,
      choices,
      type,
    },
  } satisfies AnswerRequest;
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

  const question = parsed.question;
  const cacheKey = buildCacheKey(question);
  const cached = cache.get(cacheKey);

  if (cached) {
    const payload: AnswerResponse = {
      answer: cached.answer,
    };
    return json(payload, { status: 200 });
  }

  try {
    const client = getRouterClient();
    const answer = await client.answer(question);
    await cache.set(cacheKey, answer);

    const payload: AnswerResponse = {
      answer,
    };
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
