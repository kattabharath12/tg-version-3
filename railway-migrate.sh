#!/bin/bash

set -e

echo "🚀 Starting Railway migration script..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not set"
  exit 1
fi

echo "✅ DATABASE_URL is set"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Create uploads directory if it doesn't exist
echo "📁 Creating uploads directory..."
mkdir -p /app/uploads
chmod 755 /app/uploads

echo "✅ Migration completed successfully!"
