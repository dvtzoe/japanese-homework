import { PrismaClient } from "@prisma/client";

export interface CacheEntry {
  answer: string;
}

export class PersistentCache {
  #prisma: PrismaClient;

  constructor() {
    this.#prisma = new PrismaClient();
  }

  async init() {
    // Test the database connection
    try {
      await this.#prisma.$connect();
      console.log("Database connected successfully");
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw error;
    }
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const entry = await this.#prisma.cacheEntry.findUnique({
      where: { id: key },
    });
    if (!entry) {
      return undefined;
    }
    return { answer: entry.answer };
  }

  async entries(): Promise<Array<[string, CacheEntry]>> {
    const allEntries = await this.#prisma.cacheEntry.findMany();
    return allEntries.map((entry: { id: string; answer: string }) => [
      entry.id,
      { answer: entry.answer },
    ]);
  }

  async set(key: string, answer: string) {
    await this.#prisma.cacheEntry.upsert({
      where: { id: key },
      create: {
        id: key,
        answer,
      },
      update: {
        answer,
      },
    });
  }

  async disconnect() {
    await this.#prisma.$disconnect();
  }
}
