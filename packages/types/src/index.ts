export type QuestionKind =
  | "short_answer"
  | "radio"
  | "dropdown"
  | "unknown";

export interface QuestionPayload {
  text: string;
  imageUrls: string[];
  choices?: string[];
  type: QuestionKind;
}

export interface AnswerRequest {
  question: QuestionPayload;
}

export interface AnswerResponse {
  answer: string;
}

export type MessagesContent = ({
  type: "text";
  text: string;
} | {
  type: "image_url";
  image_url: { url: string };
})[];
