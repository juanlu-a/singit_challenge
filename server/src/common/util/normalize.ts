/**
 * Shared word normalization used as the join key between occurrences, insights and user vocabulary.
 *
 * NOTE: real lemmatization ("done" -> "do") is an upstream NLP concern (see Part 1, §3). In the
 * Part 2 practice layer the `normalizedWord` already arrives on the insight; this helper only does
 * the lightweight, deterministic canonicalization we still need on the boundary (casing/trimming/
 * surrounding punctuation) so lookups are stable.
 */
export function normalizeWord(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}
