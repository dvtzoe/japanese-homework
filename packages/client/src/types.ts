import type { QuestionPayload } from "@jphw/types";
import type { Locator } from "playwright";

export interface Credentials {
  email: string;
  class: string;
  id: string;
  name: string;
}

export interface ClientOptions {
  url: string;
  serverUrl?: string;
  headless?: boolean;
  profileDir?: string;
  credentials?: Credentials;
  onConfirmNext?: (
    details: { pageIndex: number; questionCount: number },
  ) => Promise<boolean>;
  onConfirmSubmit?: (
    details: { pageIndex: number; questionCount: number },
  ) => Promise<boolean>;
}

export interface QuestionContext {
  payload: QuestionPayload;
  locator: Locator;
}
