/**
 * AnalysisService.
 *
 * Owns the deterministic analysis pipeline: parse source into an AST,
 * run static analysis rules against it, and produce the structured
 * findings JSON that later gets sent to the AIService.
 *
 * This service depends only on /domain types and /analysis utilities.
 * It must never import an AI provider — analysis has to work and be
 * testable with zero network calls.
 *
 * Filled in starting Milestone 3 (AST fundamentals).
 */

export {};
