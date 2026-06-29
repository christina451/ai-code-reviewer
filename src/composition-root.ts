/**
 * Composition root.
 *
 * The one file in this codebase that's allowed to know about every
 * concrete implementation (OpenRouterAIService, Postgres repository,
 * Redis cache) and wire them into the services that depend only on
 * interfaces. API routes import their dependencies from here instead
 * of constructing concrete classes themselves.
 *
 * This is our lightweight stand-in for a DI container — appropriate
 * because Next.js API routes are stateless functions, not a long-lived
 * app where a full DI framework would pay for itself.
 *
 * Filled in incrementally as each concrete implementation lands.
 */

export {};
