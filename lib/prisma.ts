import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client Singleton
 * 
 * This module provides a singleton instance of the Prisma Client to prevent
 * multiple instances from being created during development (hot reloading).
 * 
 * The Prisma Client is configured with binary targets for different deployment
 * environments including Railway, Docker, and other Linux environments.
 * 
 * Binary targets configured in schema.prisma:
 * - native: for local development
 * - debian-openssl-3.0.x: for Debian-based systems
 * - linux-musl-openssl-3.0.x: for Alpine Linux and Railway
 * 
 * Usage:
 * ```typescript
 * import { prisma } from "@/lib/prisma";
 * 
 * // Query examples
 * const user = await prisma.user.findUnique({
 *   where: { email: "user@example.com" }
 * });
 * 
 * const documents = await prisma.document.findMany({
 *   where: { userId: user.id }
 * });
 * ```
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma Client instance
 * 
 * In development, this prevents multiple instances from being created
 * during hot module replacement (HMR).
 * 
 * In production, a new instance is created for each deployment.
 */
export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

/**
 * Graceful shutdown handler
 * Disconnects from the database when the process terminates
 */
if (process.env.NODE_ENV === "production") {
  const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
