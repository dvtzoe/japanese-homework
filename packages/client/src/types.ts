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
  browser?: "chromium" | "firefox";
  credentials?: Credentials;
  onConfirmNext?: (
    details: { pageIndex: number; questionCount: number },
  ) => Promise<boolean>;
  onConfirmSubmit?: (
    details: { pageIndex: number; questionCount: number },
  ) => Promise<boolean>;
  onConfirmClose?: () => Promise<boolean>;
  screenshotPath?: string;
}

export interface QuestionContext {
  payload: QuestionPayload;
  locator: Locator;
}
