import type {
  AnswerBatchResponse,
  AnswerResponse,
  QuestionPayload,
} from "@jphw/types";

function normalizeBaseUrl(serverUrl: string): string {
  return serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;
}

export async function requestAnswers(
  serverUrl: string,
  questions: QuestionPayload[],
): Promise<string[]> {
  if (questions.length === 0) {
    return [];
  }

  const response = await fetch(`${normalizeBaseUrl(serverUrl)}/answers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ questions }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Server responded with ${response.status}: ${detail}`);
  }

  const payload = await response.json() as AnswerBatchResponse;
  if (!Array.isArray(payload.answers)) {
    throw new Error("Server response missing 'answers'");
  }

  if (payload.answers.length !== questions.length) {
    throw new Error("Server returned mismatched answer count");
  }

  return payload.answers;
}

export async function requestAnswer(
  serverUrl: string,
  question: QuestionPayload,
): Promise<AnswerResponse> {
  const [answer] = await requestAnswers(serverUrl, [question]);
  return { answer } satisfies AnswerResponse;
}
