# PostgreSQL Setup Guide

This guide explains how to set up the server with PostgreSQL database for caching.

## Prerequisites

1. **PostgreSQL Database**: You need a running PostgreSQL instance. You can:
   - Install PostgreSQL locally
   - Use a hosted service (e.g., Supabase, Neon, Railway, or AWS RDS)
   - Use Docker: `docker run --name jphw-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`

2. **Deno**: Ensure you have Deno installed (see main README)

3. **Node.js/npm**: Required for running Prisma CLI commands

## Setup Steps

### 1. Configure Database Connection

Create a `.env` file in the `apps/server` directory with your database connection string:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

For example, with default local PostgreSQL:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jphw"
```

**Important Environment Variables:**
- `DATABASE_URL` (required): PostgreSQL connection string
- `OPENROUTER_API_KEY` (required): Your OpenRouter API key
- `OPENROUTER_MODEL` (optional): The LLM model to use
- `PORT` (optional, default: 8000): Server port
- `TLS_CERT_FILE` (optional): Path to TLS certificate for HTTPS
- `TLS_KEY_FILE` (optional): Path to TLS private key for HTTPS

### 2. Install Dependencies

The server uses Prisma with Deno's npm compatibility. Deno will automatically install dependencies when you run the server, but you need to allow npm lifecycle scripts:

```bash
cd apps/server
deno install --allow-scripts=npm:@prisma/engines,npm:@prisma/client
```

### 3. Install Prisma CLI

```bash
npm install -g prisma
```

Or use it via npx without installing:
```bash
npx prisma --version
```

### 4. Generate Prisma Client

Navigate to the server directory and generate the Prisma client:

```bash
cd apps/server
npx prisma generate
```

This will create the Prisma client that the server code uses. The client is automatically configured to work with Deno.

**Note:** The server's `deno.json` has `"nodeModulesDir": "auto"` which enables npm package lifecycle scripts required by Prisma.

### 5. Run Database Migrations

Create the database schema:

```bash
cd apps/server
npx prisma migrate dev --name init
```

This will:
- Create the `cache_entries` table in your PostgreSQL database
- Apply all necessary migrations

For production, use:
```bash
npx prisma migrate deploy
```

### 6. Start the Server

From the project root:

```bash
deno task start:server
```

Or with environment variables:

```bash
OPENROUTER_API_KEY=your_key DATABASE_URL="postgresql://..." deno task start:server
```

## Automated Setup (Linux/macOS)

You can use the provided setup script:

```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/jphw"
./scripts/setup_prisma.sh
```

## Database Schema

The cache uses a simple schema:

```prisma
model CacheEntry {
  id        String   @id          // SHA-256 hash of the question
  answer    String                // Cached answer
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Prisma Studio (Database GUI)

To view and manage your data with a GUI:

```bash
cd apps/server
npx prisma studio
```

This will open a web interface at `http://localhost:5555`.

## Troubleshooting

### Connection Issues

If you get connection errors:

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

2. Check your `DATABASE_URL` format:
   ```
   postgresql://[user[:password]@][host][:port][/dbname][?param=value&...]
   ```

3. Ensure the database exists:
   ```bash
   psql -U postgres -c "CREATE DATABASE jphw;"
   ```

### Migration Errors

If migrations fail:

1. Check database permissions
2. Verify the user has CREATE TABLE privileges
3. Try resetting the database (WARNING: deletes all data):
   ```bash
   cd apps/server
   npx prisma migrate reset
   ```

### Prisma Client Not Found

If you get "Cannot find module '@prisma/client'":

1. Make sure you ran `npx prisma generate`
2. Check that `generated/client` exists in `apps/server/`
3. Try clearing the Deno cache:
   ```bash
   deno cache --reload apps/server/src/index.ts
   ```

## Migration from JSON Cache

The new implementation doesn't automatically migrate existing JSON cache data. If you have important cached data, you can manually migrate it:

1. Export from JSON (if you have the old `data/cache.json`):
   ```bash
   cat apps/server/data/cache.json | jq -r 'to_entries[] | "\(.key)\t\(.value.answer)"'
   ```

2. Import to PostgreSQL:
   Create a script or manually insert the entries using Prisma Studio or SQL:
   ```sql
   INSERT INTO cache_entries (id, answer, "createdAt", "updatedAt")
   VALUES ('key_hash', 'answer_text', NOW(), NOW());
   ```

## Development vs Production

### Development
- Use `npx prisma migrate dev` to create and apply migrations
- Prisma Studio is useful for debugging
- Connection pooling is handled automatically

### Production
- Use `npx prisma migrate deploy` to apply migrations
- Set `DATABASE_URL` to use connection pooling (e.g., PgBouncer)
- Consider using a managed PostgreSQL service
- Monitor connection counts and query performance

## Performance Tips

1. **Connection Pooling**: Use PgBouncer or your provider's pooling
2. **Indexes**: The `id` field is already indexed (primary key)
3. **Query Optimization**: Prisma handles most optimizations automatically
4. **Caching**: PostgreSQL query results are cached in memory by the database

## Hosted PostgreSQL Options

### Free Tier Options:
- **Supabase**: Free tier with 500MB database
- **Neon**: Serverless PostgreSQL with generous free tier
- **Railway**: $5/month credit, easy setup
- **ElephantSQL**: Free tier available

### Example with Supabase:
1. Create a project at https://supabase.com
2. Go to Settings > Database
3. Copy the connection string (Transaction mode)
4. Set it as your `DATABASE_URL`

## Security Considerations

1. **Never commit** your `.env` file or `DATABASE_URL`
2. Use **strong passwords** for database users
3. Enable **SSL/TLS** for database connections in production
4. Restrict **network access** to your database (firewall rules)
5. Regularly **backup** your database
6. Use **read-only replicas** if scaling read-heavy workloads

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Deno with Prisma](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-deno-deploy)
