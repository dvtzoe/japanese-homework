import { ensureDir } from "@std/fs/ensure-dir";
import { dirname, fromFileUrl } from "@std/path";

export interface CacheEntry {
  answer: string;
}

export class PersistentCache {
  #path: string;
  #memory = new Map<string, CacheEntry>();

  constructor(path: URL = new URL("../data/cache.json", import.meta.url)) {
    this.#path = fromFileUrl(path);
  }

  async init() {
    try {
      const raw = await Deno.readTextFile(this.#path);
      const data = JSON.parse(raw) as Record<string, CacheEntry>;
      for (const [key, value] of Object.entries(data)) {
        this.#memory.set(key, value);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        await ensureDir(dirname(this.#path));
        await this.#write();
      } else {
        throw error;
      }
    }
  }

  get(key: string): CacheEntry | undefined {
    return this.#memory.get(key);
  }

  entries(): IterableIterator<[string, CacheEntry]> {
    return this.#memory.entries();
  }

  async set(key: string, answer: string) {
    this.#memory.set(key, {
      answer,
    });
    await this.#write();
  }

  #serialize(): string {
    const object = Object.fromEntries(this.#memory.entries());
    return JSON.stringify(object, null, 2);
  }

  async #write() {
    await ensureDir(dirname(this.#path));
    await Deno.writeTextFile(this.#path, this.#serialize());
  }
}
