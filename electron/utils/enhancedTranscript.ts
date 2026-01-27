/**
 * Enhanced transcript utilities.
 * Narrative generation logic has been moved to shared/narrativeBuilder.ts
 * to allow both the renderer and backend to use the same implementation.
 *
 * This file now re-exports the shared function for backward compatibility.
 */

export { buildNarrativeWithSentenceLevelDistribution } from '../../shared/narrativeBuilder'
