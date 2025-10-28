#!/bin/bash
# Setup script for Prisma with PostgreSQL

set -e

echo "Setting up Prisma for the server..."

cd "$(dirname "$0")/../apps/server"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL='postgresql://user:password@localhost:5432/jphw'"
    exit 1
fi

echo "Installing Prisma CLI..."
deno install -A npm:prisma@latest

echo "Generating Prisma Client..."
npx prisma generate --schema=./prisma/schema.prisma

echo "Running database migrations..."
npx prisma migrate dev --schema=./prisma/schema.prisma --name init

echo "Setup complete!"
echo ""
echo "To start the server, run:"
echo "  deno task start:server"
