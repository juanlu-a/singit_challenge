import { ExerciseType } from '../../common/enums';
import { ExerciseGeneratorService, GeneratorInsight } from './exercise-generator.service';

function insight(
  over: Partial<GeneratorInsight> & { externalId: string; word: string },
): GeneratorInsight {
  return {
    normalizedWord: over.word,
    language: 'en',
    translations: [],
    imageRefs: [],
    ...over,
  };
}

const target = insight({
  externalId: 'insight_001',
  word: 'darling',
  translations: [{ language: 'es', text: 'cariño' }],
  imageRefs: [{ id: 'img1', url: 'https://x/darling.png' }],
});

const pool: GeneratorInsight[] = [
  target,
  insight({
    externalId: 'insight_002',
    word: 'love',
    translations: [{ language: 'es', text: 'amor' }],
    imageRefs: [{ id: 'img2', url: 'https://x/love.png' }],
  }),
  insight({
    externalId: 'insight_003',
    word: 'fire',
    translations: [{ language: 'es', text: 'fuego' }],
    imageRefs: [{ id: 'img3', url: 'https://x/fire.png' }],
  }),
  insight({
    externalId: 'insight_004',
    word: 'heart',
    translations: [{ language: 'es', text: 'corazón' }],
    imageRefs: [{ id: 'img4', url: 'https://x/heart.png' }],
  }),
];

describe('ExerciseGeneratorService', () => {
  const gen = new ExerciseGeneratorService();
  const baseSeed = 'seed-1';

  describe('word_meaning', () => {
    it('builds a question whose correct option is the target translation', () => {
      const res = gen.generate({
        type: ExerciseType.WORD_MEANING,
        target,
        pool,
        translationLanguage: 'es',
        seed: baseSeed,
        exerciseId: 'ex_0',
      });
      expect('exercise' in res).toBe(true);
      if (!('exercise' in res)) return;
      const ex = res.exercise;
      expect(ex.prompt).toBe('darling');
      const correct = ex.options.find((o) => o.id === ex.correctOptionId);
      expect(correct?.value).toBe('cariño');
      expect(ex.options.length).toBeGreaterThanOrEqual(2);
    });

    it('skips when no translationLanguage is provided', () => {
      const res = gen.generate({
        type: ExerciseType.WORD_MEANING,
        target,
        pool,
        seed: baseSeed,
        exerciseId: 'ex_0',
      });
      expect('skipped' in res).toBe(true);
    });

    it('skips when the target has no translation in the requested language', () => {
      const res = gen.generate({
        type: ExerciseType.WORD_MEANING,
        target,
        pool,
        translationLanguage: 'fr',
        seed: baseSeed,
        exerciseId: 'ex_0',
      });
      expect('skipped' in res).toBe(true);
    });

    it('is deterministic for the same seed and inputs', () => {
      const params = {
        type: ExerciseType.WORD_MEANING,
        target,
        pool,
        translationLanguage: 'es',
        seed: baseSeed,
        exerciseId: 'ex_0',
      };
      expect(gen.generate(params)).toEqual(gen.generate(params));
    });
  });

  describe('reverse_translation', () => {
    it('prompts with the translation and the correct option is the source word', () => {
      const res = gen.generate({
        type: ExerciseType.REVERSE_TRANSLATION,
        target,
        pool,
        translationLanguage: 'es',
        seed: baseSeed,
        exerciseId: 'ex_1',
      });
      expect('exercise' in res).toBe(true);
      if (!('exercise' in res)) return;
      const ex = res.exercise;
      expect(ex.prompt).toBe('cariño');
      const correct = ex.options.find((o) => o.id === ex.correctOptionId);
      expect(correct?.value).toBe('darling');
    });
  });

  describe('word_to_image', () => {
    it('builds an image question when enough images exist', () => {
      const res = gen.generate({
        type: ExerciseType.WORD_TO_IMAGE,
        target,
        pool,
        seed: baseSeed,
        exerciseId: 'ex_2',
      });
      expect('exercise' in res).toBe(true);
      if (!('exercise' in res)) return;
      const ex = res.exercise;
      const correct = ex.options.find((o) => o.id === ex.correctOptionId);
      expect(correct?.imageUrl).toBe('https://x/darling.png');
      expect(ex.options.every((o) => !!o.imageUrl)).toBe(true);
    });

    it('skips when the target has no image', () => {
      const noImage = insight({ externalId: 'insight_099', word: 'whisper' });
      const res = gen.generate({
        type: ExerciseType.WORD_TO_IMAGE,
        target: noImage,
        pool,
        seed: baseSeed,
        exerciseId: 'ex_2',
      });
      expect('skipped' in res).toBe(true);
    });

    it('skips when there are not enough image distractors', () => {
      const lonePool = [target]; // only the target has an image
      const res = gen.generate({
        type: ExerciseType.WORD_TO_IMAGE,
        target,
        pool: lonePool,
        seed: baseSeed,
        exerciseId: 'ex_2',
      });
      expect('skipped' in res).toBe(true);
    });
  });
});
