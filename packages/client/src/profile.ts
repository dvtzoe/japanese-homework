import { resolve } from "@std/path";

export async function ensureProfileDir(dir: string): Promise<string> {
  const resolved = resolve(Deno.cwd(), dir);
  await Deno.mkdir(resolved, { recursive: true });
  return resolved;
}
