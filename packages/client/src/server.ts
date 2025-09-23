import type {
  AnswerRequest,
  AnswerResponse,
  QuestionPayload,
} from "@jphw/types";

export async function requestAnswer(
  serverUrl: string,
  question: QuestionPayload,
): Promise<AnswerResponse> {
  const baseUrl = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;
  const response = await fetch(`${baseUrl}/jphw/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question } satisfies AnswerRequest),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Server responded with ${response.status}: ${detail}`);
  }

  return await response.json() as AnswerResponse;
}
