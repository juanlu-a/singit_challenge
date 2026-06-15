/** Knowledge status of a word for a user. */
export enum VocabularyStatus {
  UNKNOWN = 'unknown',
  LEARNING = 'learning',
  KNOWN = 'known',
  IGNORED = 'ignored',
}

/** Where an insight came from. Kept open-ended; `song` is the example source. */
export enum InsightSource {
  SONG = 'song',
  MANUAL = 'manual',
}

/** Supported exercise types. */
export enum ExerciseType {
  WORD_MEANING = 'word_meaning',
  REVERSE_TRANSLATION = 'reverse_translation',
  WORD_TO_IMAGE = 'word_to_image',
}
