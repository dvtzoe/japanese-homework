import pg from "pg";

const { Pool } = pg;

export interface CacheEntry {
  answer: string;
}

export class PersistentCache {
  #pool: pg.Pool;

  constructor() {
    const databaseUrl = Deno.env.get("DATABASE_URL");
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    this.#pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  async init() {
    // Test the database connection and create table if it doesn't exist
    try {
      const client = await this.#pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS cache_entries (
            id TEXT PRIMARY KEY,
            answer TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log("Database connected successfully");
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw error;
    }
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const result = await this.#pool.query(
      "SELECT answer FROM cache_entries WHERE id = $1",
      [key],
    );
    if (result.rows.length === 0) {
      return undefined;
    }
    return { answer: result.rows[0].answer };
  }

  async entries(): Promise<Array<[string, CacheEntry]>> {
    const result = await this.#pool.query(
      "SELECT id, answer FROM cache_entries",
    );
    return result.rows.map((row: { id: string; answer: string }) => [
      row.id,
      { answer: row.answer },
    ]);
  }

  async set(key: string, answer: string) {
    await this.#pool.query(
      `INSERT INTO cache_entries (id, answer, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (id)
       DO UPDATE SET answer = $2, updated_at = CURRENT_TIMESTAMP`,
      [key, answer],
    );
  }

  async disconnect() {
    await this.#pool.end();
  }
}
