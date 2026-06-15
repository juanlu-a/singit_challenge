export type VocabStatus = 'unknown' | 'learning' | 'known' | 'ignored';
export type ExerciseType = 'word_meaning' | 'reverse_translation' | 'word_to_image';

export interface Translation {
  language: string;
  text: string;
}

export interface UserWordInsight {
  wordInsightId: string;
  word: string;
  normalizedWord: string;
  language: string;
  difficulty: number;
  frequency: number;
  translations: Translation[];
  status: VocabStatus;
  correctCount: number;
  incorrectCount: number;
  lastPracticedAt: string | null;
  priorityScore: number;
  recommendationReason: string;
}

export interface Paginated<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface InsightSummary {
  userId: string;
  totalInsights: number;
  byStatus: Record<VocabStatus, number>;
  attemptStats: {
    totalAttempts: number;
    totalCorrect: number;
    totalIncorrect: number;
    accuracy: number | null;
  };
  recommendedWords: {
    wordInsightId: string;
    word: string;
    priorityScore: number;
    recommendationReason: string;
  }[];
}

export interface ExerciseOption {
  id: string;
  value?: string;
  imageUrl?: string;
}

export interface Exercise {
  exerciseId: string;
  type: ExerciseType;
  wordInsightId: string;
  word: string;
  prompt: string;
  promptLanguage: string;
  translationLanguage?: string;
  options: ExerciseOption[];
  answered: boolean;
}

export interface PracticeSession {
  sessionId: string;
  userId: string;
  status: string;
  config: Record<string, unknown>;
  exercises: Exercise[];
  skipped: { wordInsightId: string; reason: string }[];
}

export interface AttemptResult {
  sessionId: string;
  exerciseId: string;
  wordInsightId: string;
  word: string;
  isCorrect: boolean;
  correctOptionId: string;
  previousStatus: VocabStatus | null;
  newStatus: VocabStatus | null;
}

export interface SessionResults {
  sessionId: string;
  userId: string;
  status: string;
  totalExercises: number;
  correctCount: number;
  incorrectCount: number;
  completed: unknown[];
  pending: unknown[];
  vocabularyState: {
    wordInsightId: string;
    word: string;
    status: VocabStatus;
    correctCount: number;
    incorrectCount: number;
    lastPracticedAt: string | null;
  }[];
}
