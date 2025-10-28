# PostgreSQL Setup Guide

This guide explains how to set up the server with PostgreSQL database for
caching.

## Prerequisites

1. **PostgreSQL Database**: You need a running PostgreSQL instance. You can:
   - Install PostgreSQL locally
   - Use a hosted service (e.g., Supabase, Neon, Railway, or AWS RDS)
   - Use Docker:
     `docker run --name jphw-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`

2. **Deno**: Ensure you have Deno installed (see main README)

## Setup Steps

### 1. Configure Database Connection

Create a `.env` file in the project root or set the environment variable:

```bash
DATABASE_URL="<your_user>:<password>@<host>:<port>/<database_name>"
```

For example, with default local PostgreSQL:

```bash
DATABASE_URL="your_user:pass@localhost:5432/jphw"
```

**Important Environment Variables:**

- `DATABASE_URL` (required): PostgreSQL connection string
- `OPENROUTER_API_KEY` (required): Your OpenRouter API key
- `OPENROUTER_MODEL` (optional): The LLM model to use
- `PORT` (optional, default: 8000): Server port
- `TLS_CERT_FILE` (optional): Path to TLS certificate for HTTPS
- `TLS_KEY_FILE` (optional): Path to TLS private key for HTTPS

### 2. Create Database (if needed)

If the database doesn't exist, create it:

```bash
psql -U postgres -c "CREATE DATABASE jphw;"
```

Or use your PostgreSQL hosting service's dashboard to create a database.

### 3. Start the Server

The server will automatically create the necessary table on first run:

```bash
deno task start:server
```

Or with environment variables:

```bash
DATABASE_URL="your_user:password@localhost:5432/jphw" OPENROUTER_API_KEY=<your_key> deno task start:server
```

The server will automatically create the `cache_entries` table with this schema:

```sql
CREATE TABLE IF NOT EXISTS cache_entries (
  id SERIAL PRIMARY KEY,
  answer TEXT NOT NULL,
  answer_index INTEGER,
  question TEXT,
  image_hash TEXT,
  extracted_text TEXT,
  choices TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The server also creates indexes for efficient searching:

- Full-text search index on `question`
- Index on `image_hash`
- GIN index on `choices` array

## Database Schema

The cache stores detailed information about each question and answer:

| Column           | Type      | Description                                                                        |
| ---------------- | --------- | ---------------------------------------------------------------------------------- |
| `id`             | SERIAL    | Primary key - auto-incrementing ID                                                 |
| `answer`         | TEXT      | The answer provided by the LLM                                                     |
| `answer_index`   | INTEGER   | Index of the selected choice (for multiple choice questions)                       |
| `question`       | TEXT      | The question text                                                                  |
| `image_hash`     | TEXT      | SHA-256 hash of the image content (prevents duplicate entries from temporary URLs) |
| `extracted_text` | TEXT      | Text extracted from images (if image contains only text)                           |
| `choices`        | TEXT[]    | Array of answer choices (for multiple choice questions)                            |
| `created_at`     | TIMESTAMP | When the entry was created                                                         |
| `updated_at`     | TIMESTAMP | When the entry was last updated                                                    |

## API Endpoints

### GET /search

Search the cache for questions and answers.

**Query Parameters:**

- `question` (optional): Full-text search on question text
- `image_hash` (optional): Exact match on image hash
- `choices` (optional): JSON array of choices to match
- `limit` (optional, default: 50): Maximum number of results
- `offset` (optional, default: 0): Pagination offset

**Example:**

```bash
curl "http://localhost:8000/search?question=grammar&limit=10"
curl "http://localhost:8000/search?image_hash=abc123def456..."
```

**Response:**

```json
{
  "results": [
    {
      "answer": "2",
      "answer_index": 2,
      "question": "What is the correct grammar?",
      "image_hash": "abc123def456789...",
      "extracted_text": "Some text from image",
      "choices": ["Choice 1", "Choice 2", "Choice 3"]
    }
  ],
  "count": 1
}
```

## Troubleshooting

### Connection Issues

If you get connection errors:

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

2. Check your `DATABASE_URL` format:
   ```
   postgresql://<your_user>:<password>@<host>:<port>/<database_name>
   ```

3. Ensure the database exists:
   ```bash
   psql -U postgres -c "CREATE DATABASE jphw;"
   ```

4. Check firewall rules if using a remote database

### Permission Errors

If you get permission errors, ensure your PostgreSQL user has:

- `CONNECT` privilege on the database
- `CREATE` privilege to create tables (only needed on first run)
- `SELECT`, `INSERT`, `UPDATE` privileges on the `cache_entries` table

```sql
GRANT ALL PRIVILEGES ON DATABASE jphw TO your_user;
```

### SSL/TLS Issues

For hosted databases that require SSL, add `?sslmode=require` to your connection
string:

```bash
DATABASE_URL="your_user:passwordhost:5432/jphw?sslmode=require"
```

## Viewing Cache Data

You can view the cached data using any PostgreSQL client:

```bash
psql $DATABASE_URL -c "SELECT id, LEFT(answer, 50) as answer_preview, created_at FROM cache_entries ORDER BY created_at DESC LIMIT 10;"
```

Or use a GUI tool like:

- pgAdmin
- DBeaver
- TablePlus
- Postico (macOS)

## Development vs Production

### Development

- Use a local PostgreSQL instance or free tier hosted service
- Connection pooling is handled automatically by the `pg` library
- Default pool size is 10 connections

### Production

- Use a managed PostgreSQL service with automatic backups
- Consider using connection pooling (e.g., PgBouncer) for multiple server
  instances
- Set appropriate pool size based on your needs:
  ```bash
  DATABASE_URL="your_user:password@localhost:5432/jphw?max_pool_size=20"
  ```
- Monitor connection counts and query performance
- Set up regular backups

## Performance Tips

1. **Connection Pooling**: The `pg` library handles connection pooling
   automatically
2. **Indexes**: The `id` field is already indexed (primary key)
3. **Query Optimization**: Queries are simple and optimized by default
4. **Caching**: PostgreSQL query results are cached by the database

## Hosted PostgreSQL Options

### Free Tier Options:

- **Supabase**: Free tier with 500MB database, includes web UI
- **Neon**: Serverless PostgreSQL with generous free tier
- **Railway**: $5/month credit, easy setup
- **ElephantSQL**: Free tier available (20MB limit)

### Example with Supabase:

1. Create a project at https://supabase.com
2. Go to Settings > Database
3. Copy the connection string (Transaction mode or Session mode)
4. Set it as your `DATABASE_URL`

### Example with Neon:

1. Create a project at https://neon.tech
2. Copy the connection string from the dashboard
3. Set it as your `DATABASE_URL`

## Security Considerations

1. **Never commit** your `.env` file or `DATABASE_URL`
2. Use **strong passwords** for database users
3. Enable **SSL/TLS** for database connections in production
4. Restrict **network access** to your database (firewall rules)
5. Regularly **backup** your database
6. Use **read-only replicas** if scaling read-heavy workloads
7. **Monitor** for unusual query patterns or connection attempts

## Migration from JSON Cache

The server will start with an empty cache. If you have important cached data in
the old `data/cache.json` file, you can manually import it:

```bash
# Example script to import from JSON to PostgreSQL
node <<'EOF'
const fs = require('fs');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  const data = JSON.parse(fs.readFileSync('apps/server/data/cache.json', 'utf8'));
  
  for (const [id, entry] of Object.entries(data)) {
    await client.query(
      'INSERT INTO cache_entries (id, answer) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [id, entry.answer]
    );
  }
  
  await client.end();
  console.log('Migration complete');
})();
EOF
```

## Additional Resources

- [node-postgres (pg) Documentation](https://node-postgres.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Deno with npm packages](https://deno.com/manual/node/npm_specifiers)
