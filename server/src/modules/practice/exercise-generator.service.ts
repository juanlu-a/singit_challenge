import { Injectable } from '@nestjs/common';
import { ExerciseType } from '../../common/enums';
import { SeededRandom } from '../../common/util/seeded-random';
import { Exercise, ExerciseOption } from './schemas/practice-session.schema';

/** Minimal insight shape the generator needs (decoupled from the Mongoose document). */
export interface GeneratorInsight {
  externalId: string;
  word: string;
  normalizedWord: string;
  language: string;
  translations: { language: string; text: string }[];
  imageRefs: { id: string; url: string }[];
}

export interface GenerateParams {
  type: ExerciseType;
  target: GeneratorInsight;
  pool: GeneratorInsight[];
  translationLanguage?: string;
  seed: string;
  exerciseId: string;
  numOptions?: number;
}

export type GenerateResult = { exercise: Exercise } | { skipped: string };

interface Candidate {
  value?: string;
  imageUrl?: string;
  isCorrect: boolean;
}

/**
 * Generates exercises from stored insights. Fully deterministic: option order and distractor choice
 * are driven by a SeededRandom seeded from a stable string, so identical inputs always yield the
 * identical exercise. Returns `{ skipped, reason }` when there is not enough data to build a valid
 * question (e.g. missing translation, too few image distractors) instead of fabricating answers.
 */
@Injectable()
export class ExerciseGeneratorService {
  static readonly DEFAULT_NUM_OPTIONS = 4;
  static readonly MIN_OPTIONS = 2; // at least one correct + one distractor

  generate(params: GenerateParams): GenerateResult {
    switch (params.type) {
      case ExerciseType.WORD_MEANING:
        return this.wordMeaning(params);
      case ExerciseType.REVERSE_TRANSLATION:
        return this.reverseTranslation(params);
      case ExerciseType.WORD_TO_IMAGE:
        return this.wordToImage(params);
      default:
        return { skipped: `unsupported exercise type '${params.type}'` };
    }
  }

  /** Choose the correct translation of a word among distractor translations. */
  private wordMeaning(params: GenerateParams): GenerateResult {
    const lang = params.translationLanguage;
    if (!lang) return { skipped: 'translationLanguage is required for word_meaning' };

    const correct = translationFor(params.target, lang);
    if (!correct) return { skipped: `target has no '${lang}' translation` };

    const distractors = unique(
      params.pool
        .filter((p) => p.externalId !== params.target.externalId)
        .map((p) => translationFor(p, lang))
        .filter((t): t is string => !!t && t !== correct),
    );

    return this.assemble(params, {
      prompt: params.target.word,
      promptLanguage: params.target.language,
      correct: { value: correct, isCorrect: true },
      distractorValues: distractors.map((value) => ({ value, isCorrect: false })),
    });
  }

  /** Choose the source-language word for a translated meaning. */
  private reverseTranslation(params: GenerateParams): GenerateResult {
    const lang = params.translationLanguage;
    if (!lang) return { skipped: 'translationLanguage is required for reverse_translation' };

    const prompt = translationFor(params.target, lang);
    if (!prompt) return { skipped: `target has no '${lang}' translation` };

    const distractors = unique(
      params.pool
        .filter((p) => p.externalId !== params.target.externalId && p.word !== params.target.word)
        .map((p) => p.word),
    );

    return this.assemble(params, {
      prompt,
      promptLanguage: lang,
      correct: { value: params.target.word, isCorrect: true },
      distractorValues: distractors.map((value) => ({ value, isCorrect: false })),
    });
  }

  /** Choose the image that best represents a word. */
  private wordToImage(params: GenerateParams): GenerateResult {
    const targetImage = params.target.imageRefs[0];
    if (!targetImage) return { skipped: 'target has no image' };

    const distractors = unique(
      params.pool
        .filter((p) => p.externalId !== params.target.externalId)
        .flatMap((p) => p.imageRefs)
        .filter((img) => img.url !== targetImage.url)
        .map((img) => img.url),
    );

    return this.assemble(params, {
      prompt: params.target.word,
      promptLanguage: params.target.language,
      correct: { imageUrl: targetImage.url, isCorrect: true },
      distractorValues: distractors.map((imageUrl) => ({ imageUrl, isCorrect: false })),
    });
  }

  /** Shared assembly: pick distractors deterministically, shuffle, assign stable option ids. */
  private assemble(
    params: GenerateParams,
    parts: {
      prompt: string;
      promptLanguage: string;
      correct: Candidate;
      distractorValues: Candidate[];
    },
  ): GenerateResult {
    const numOptions = params.numOptions ?? ExerciseGeneratorService.DEFAULT_NUM_OPTIONS;
    const rng = new SeededRandom(params.seed);

    // Sort distractors for a stable base order, then sample deterministically.
    const sortedDistractors = [...parts.distractorValues].sort(compareCandidate);
    const chosen = rng.sample(sortedDistractors, numOptions - 1);

    if (chosen.length + 1 < ExerciseGeneratorService.MIN_OPTIONS) {
      return { skipped: 'not enough distractors to build a valid question' };
    }

    const shuffled = rng.shuffle([parts.correct, ...chosen]);
    const options: ExerciseOption[] = shuffled.map((c, i) => ({
      id: `opt_${i}`,
      value: c.value,
      imageUrl: c.imageUrl,
    }));
    const correctIndex = shuffled.findIndex((c) => c.isCorrect);
    const correctOptionId = options[correctIndex].id;

    const exercise: Exercise = {
      exerciseId: params.exerciseId,
      type: params.type,
      wordInsightId: params.target.externalId,
      word: params.target.word,
      prompt: parts.prompt,
      promptLanguage: parts.promptLanguage,
      translationLanguage: params.translationLanguage,
      options,
      correctOptionId,
      answered: false,
    };
    return { exercise };
  }
}

function translationFor(insight: GeneratorInsight, language: string): string | undefined {
  return insight.translations.find((t) => t.language === language)?.text;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function compareCandidate(a: Candidate, b: Candidate): number {
  const av = a.value ?? a.imageUrl ?? '';
  const bv = b.value ?? b.imageUrl ?? '';
  return av.localeCompare(bv);
}
