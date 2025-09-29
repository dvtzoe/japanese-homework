import { dirname, resolve } from "@std/path";
import { copy, ensureDir } from "@std/fs";
import { homedir } from "node:os";

const BUNDLED_PLAYWRIGHT_BROWSERS_PATH = resolve(
  Deno.execPath().endsWith("deno")
    ? dirname(import.meta.filename as string)
    : dirname(Deno.execPath()),
  "ms-playwright",
);

const defaultPlaywrightBrowsersParentDir = ((): string => {
  switch (Deno.build.os) {
    case "windows":
      return resolve(homedir(), "AppData", "Local");
    case "darwin":
      return resolve(homedir(), "Library", "Caches");
    case "linux":
      return resolve(homedir(), ".cache");
    default:
      throw new Error(`Unsupported OS: ${Deno.build.os}`);
  }
})();

export default async (): Promise<void> => {
  console.log("Ensuring Playwright browsers are in place...");
  try {
    await Deno.lstat(
      resolve(defaultPlaywrightBrowsersParentDir, "ms-playwright"),
    );
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound
    ) {
      console.log("Default Playwright browsers directory not found.");
      try {
        await Deno.lstat(BUNDLED_PLAYWRIGHT_BROWSERS_PATH);
        console.log(
          "Moving bundled Playwright browsers to the expected location...",
        );
        await ensureDir(defaultPlaywrightBrowsersParentDir);
        await copy(
          BUNDLED_PLAYWRIGHT_BROWSERS_PATH,
          resolve(defaultPlaywrightBrowsersParentDir, "ms-playwright"),
        );
        console.log("Playwright browsers moved successfully.");
      } catch (copyError) {
        console.error("Failed to move Playwright browsers:", copyError);
        throw copyError;
      }
    } else {
      console.error("Error checking Playwright browsers directory:", error);
      throw error;
    }
  }
};
