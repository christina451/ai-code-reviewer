/**
 * ReviewOrchestrator.
 *
 * Coordinates one end-to-end review request: call AnalysisService to get
 * findings, pass findings + source to AIService, persist the result via
 * a repository, and stream the response back to the caller.
 *
 * This is the only place that knows about the full sequence. Individual
 * services don't know about each other.
 *
 * Filled in during Milestone 8 (prompt design + streaming).
 */

export {};
