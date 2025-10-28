import { getServerSession as nextAuthGetServerSession } from "next-auth";
import { authOptions } from "./auth-options";

/**
 * Authentication utilities for NextAuth
 * 
 * This module provides centralized access to NextAuth configuration and session management.
 * It exports the auth options and a pre-configured getServerSession function.
 * 
 * Usage:
 * ```typescript
 * import { getServerSession, authOptions } from "@/lib/auth";
 * 
 * // In API routes or server components
 * const session = await getServerSession(authOptions);
 * ```
 */

/**
 * NextAuth configuration options
 * Includes providers, callbacks, session strategy, and pages configuration
 * 
 * Compatible with Prisma schema models:
 * - User (with firstName, lastName, email, password)
 * - Account (for OAuth providers)
 * - Session (for session management)
 * - VerificationToken (for email verification)
 */
export { authOptions } from "./auth-options";

/**
 * Pre-configured getServerSession function
 * Use this to get the current session in server-side code
 * 
 * @returns Promise<Session | null> - The current user session or null if not authenticated
 * 
 * @example
 * ```typescript
 * import { getServerSession } from "@/lib/auth";
 * 
 * export async function GET(req: NextRequest) {
 *   const session = await getServerSession();
 *   if (!session) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 *   // ... your protected route logic
 * }
 * ```
 */
export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}
