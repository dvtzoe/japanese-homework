import pg from "pg";

const { Pool } = pg;

export interface CacheEntry {
  answer: string;
  answer_index?: number;
  question?: string;
  image_url?: string;
  extracted_text?: string;
  choices?: string[];
}

export interface SearchFilters {
  question?: string;
  image_url?: string;
  choices?: string[];
  limit?: number;
  offset?: number;
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
            id SERIAL PRIMARY KEY,
            answer TEXT NOT NULL,
            answer_index INTEGER,
            question TEXT,
            image_url TEXT,
            extracted_text TEXT,
            choices TEXT[],
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create indexes for common search patterns
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_cache_entries_question 
          ON cache_entries USING gin(to_tsvector('english', COALESCE(question, '')))
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_cache_entries_image_url 
          ON cache_entries (image_url)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_cache_entries_choices 
          ON cache_entries USING gin(choices)
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

  async get(
    question?: string,
    imageUrl?: string,
    choices?: string[],
  ): Promise<CacheEntry | undefined> {
    // Build dynamic query based on available parameters
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (question) {
      conditions.push(`question = $${paramIndex++}`);
      params.push(question);
    }

    if (imageUrl) {
      conditions.push(`image_url = $${paramIndex++}`);
      params.push(imageUrl);
    }

    if (choices && choices.length > 0) {
      conditions.push(`choices = $${paramIndex++}`);
      params.push(choices);
    }

    if (conditions.length === 0) {
      return undefined;
    }

    const query = `
      SELECT answer, answer_index, question, image_url, extracted_text, choices
      FROM cache_entries
      WHERE ${conditions.join(" AND ")}
      LIMIT 1
    `;

    const result = await this.#pool.query(query, params);
    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      answer: row.answer,
      answer_index: row.answer_index,
      question: row.question,
      image_url: row.image_url,
      extracted_text: row.extracted_text,
      choices: row.choices,
    };
  }

  async search(filters: SearchFilters): Promise<CacheEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.question) {
      conditions.push(
        `to_tsvector('english', COALESCE(question, '')) @@ plainto_tsquery('english', $${paramIndex++})`,
      );
      params.push(filters.question);
    }

    if (filters.image_url) {
      conditions.push(`image_url = $${paramIndex++}`);
      params.push(filters.image_url);
    }

    if (filters.choices && filters.choices.length > 0) {
      conditions.push(`choices = $${paramIndex++}`);
      params.push(filters.choices);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const query = `
      SELECT id, answer, answer_index, question, image_url, extracted_text, choices, created_at, updated_at
      FROM cache_entries
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await this.#pool.query(query, params);
    return result.rows.map(
      (row: {
        answer: string;
        answer_index: number;
        question: string;
        image_url: string;
        extracted_text: string;
        choices: string[];
      }) => ({
        answer: row.answer,
        answer_index: row.answer_index,
        question: row.question,
        image_url: row.image_url,
        extracted_text: row.extracted_text,
        choices: row.choices,
      }),
    );
  }

  async entries(): Promise<Array<[string, CacheEntry]>> {
    const result = await this.#pool.query(
      "SELECT id, answer, answer_index, question, image_url, extracted_text, choices FROM cache_entries",
    );
    return result.rows.map(
      (row: {
        id: string;
        answer: string;
        answer_index: number;
        question: string;
        image_url: string;
        extracted_text: string;
        choices: string[];
      }) => [
        row.id,
        {
          answer: row.answer,
          answer_index: row.answer_index,
          question: row.question,
          image_url: row.image_url,
          extracted_text: row.extracted_text,
          choices: row.choices,
        },
      ],
    );
  }

  async set(entry: CacheEntry) {
    await this.#pool.query(
      `INSERT INTO cache_entries (answer, answer_index, question, image_url, extracted_text, choices, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        entry.answer,
        entry.answer_index ?? null,
        entry.question ?? null,
        entry.image_url ?? null,
        entry.extracted_text ?? null,
        entry.choices ?? null,
      ],
    );
  }

  async disconnect() {
    await this.#pool.end();
  }
}
