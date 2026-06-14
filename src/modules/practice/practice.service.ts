import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { ExerciseType, VocabularyStatus } from '../../common/enums';
import { WordInsight, WordInsightDocument } from '../word-insights/schemas/word-insight.schema';
import { UserVocabularyService } from '../user-vocabulary/user-vocabulary.service';
import {
  Exercise,
  PracticeSession,
  PracticeSessionDocument,
} from './schemas/practice-session.schema';
import { ExerciseAttempt, ExerciseAttemptDocument } from './schemas/exercise-attempt.schema';
import { ExerciseGeneratorService, GeneratorInsight } from './exercise-generator.service';
import { CreatePracticeSessionDto, SubmitAttemptDto } from './dto/practice.dto';

const DEFAULT_STATUSES = [VocabularyStatus.UNKNOWN, VocabularyStatus.LEARNING];
const ALL_TYPES = [
  ExerciseType.WORD_MEANING,
  ExerciseType.REVERSE_TRANSLATION,
  ExerciseType.WORD_TO_IMAGE,
];

@Injectable()
export class PracticeService {
  constructor(
    @InjectModel(PracticeSession.name)
    private readonly sessionModel: Model<PracticeSessionDocument>,
    @InjectModel(ExerciseAttempt.name)
    private readonly attemptModel: Model<ExerciseAttemptDocument>,
    @InjectModel(WordInsight.name)
    private readonly insightModel: Model<WordInsightDocument>,
    private readonly userVocab: UserVocabularyService,
    private readonly generator: ExerciseGeneratorService,
  ) {}

  /**
   * Create a session of generated exercises. Words are chosen by the prioritization ranking; for
   * each candidate we try exercise types in a rotating order and keep the first that yields a valid
   * question. Words with insufficient data are recorded in `skipped`, never faked.
   */
  async createSession(userId: string, dto: CreatePracticeSessionDto) {
    const statuses = dto.statuses?.length ? dto.statuses : DEFAULT_STATUSES;
    const types = dto.exerciseTypes?.length ? dto.exerciseTypes : ALL_TYPES;

    const ranked = await this.userVocab.rankInsightsForUser(userId, {
      language: dto.sourceLanguage,
      statuses,
    });
    const pool = await this.loadPool(dto.sourceLanguage);

    const exercises: Exercise[] = [];
    const skipped: { wordInsightId: string; reason: string }[] = [];

    for (let i = 0; i < ranked.length && exercises.length < dto.limit; i++) {
      const target = toGeneratorInsight(ranked[i].insight);
      const exerciseId = `ex_${exercises.length}`;
      const result = this.tryGenerate(target, pool, types, i, exerciseId, dto.translationLanguage);
      if ('exercise' in result) {
        exercises.push(result.exercise);
      } else {
        skipped.push({ wordInsightId: target.externalId, reason: result.skipped });
      }
    }

    const session = await this.sessionModel.create({
      userId,
      config: {
        limit: dto.limit,
        sourceLanguage: dto.sourceLanguage,
        translationLanguage: dto.translationLanguage,
        statuses,
        exerciseTypes: types,
      },
      exercises,
      skipped,
      status: 'active',
    });

    return this.toPublicSession(session);
  }

  /** Record an answer, validate correctness and update the user's vocabulary. */
  async submitAttempt(sessionId: string, exerciseId: string, dto: SubmitAttemptDto) {
    const session = await this.getSessionOrThrow(sessionId);
    const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exercise) {
      throw new NotFoundException(`Exercise '${exerciseId}' not found in session`);
    }

    const isCorrect = dto.answer === exercise.correctOptionId;
    exercise.answered = true;

    await this.attemptModel.create({
      userId: session.userId,
      sessionId: session.id,
      exerciseId,
      wordInsightId: exercise.wordInsightId,
      word: exercise.word,
      isCorrect,
      answer: dto.answer,
    });

    const insight = await this.insightModel
      .findOne({ externalId: exercise.wordInsightId })
      .lean()
      .exec();

    let previousStatus: VocabularyStatus | null = null;
    let newStatus: VocabularyStatus | null = null;
    if (insight) {
      const outcome = await this.userVocab.applyAttemptOutcome(session.userId, insight, isCorrect);
      previousStatus = outcome.previousStatus;
      newStatus = outcome.newStatus;
    }

    if (session.exercises.every((e) => e.answered)) {
      session.status = 'completed';
    }
    await session.save();

    return {
      sessionId: session.id,
      exerciseId,
      wordInsightId: exercise.wordInsightId,
      word: exercise.word,
      isCorrect,
      correctOptionId: exercise.correctOptionId,
      previousStatus,
      newStatus,
    };
  }

  /** Completed/pending exercises, correct/incorrect counts, and latest vocab state. */
  async getResults(sessionId: string) {
    const session = await this.getSessionOrThrow(sessionId);
    const attempts = await this.attemptModel
      .find({ sessionId: session.id })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const answerByExercise = new Map(attempts.map((a) => [a.exerciseId, a]));
    const completed = session.exercises
      .filter((e) => e.answered)
      .map((e) => {
        const attempt = answerByExercise.get(e.exerciseId);
        return {
          ...stripAnswer(e),
          correctOptionId: e.correctOptionId,
          submittedAnswer: attempt?.answer ?? null,
          isCorrect: attempt?.isCorrect ?? null,
        };
      });
    const pending = session.exercises.filter((e) => !e.answered).map(stripAnswer);

    const correctCount = attempts.filter((a) => a.isCorrect).length;
    const incorrectCount = attempts.length - correctCount;

    const practicedIds = Array.from(new Set(session.exercises.map((e) => e.wordInsightId)));
    const vocabularyState = await this.userVocab.getStates(session.userId, practicedIds);

    return {
      sessionId: session.id,
      userId: session.userId,
      status: session.status,
      totalExercises: session.exercises.length,
      correctCount,
      incorrectCount,
      completed,
      pending,
      vocabularyState: vocabularyState.map((v) => ({
        wordInsightId: v.wordInsightId,
        word: v.normalizedWord,
        status: v.status,
        correctCount: v.correctCount,
        incorrectCount: v.incorrectCount,
        lastPracticedAt: v.lastPracticedAt,
      })),
    };
  }

  /** Read a session (answers hidden) — handy for the practice UI / verification. */
  async getSession(sessionId: string) {
    const session = await this.getSessionOrThrow(sessionId);
    return this.toPublicSession(session);
  }

  private tryGenerate(
    target: GeneratorInsight,
    pool: GeneratorInsight[],
    types: ExerciseType[],
    index: number,
    exerciseId: string,
    translationLanguage?: string,
  ) {
    // Rotate the starting type per candidate so a session mixes exercise types deterministically.
    const ordered = rotate(types, index);
    let lastReason = 'no exercise type produced a valid question';
    for (const type of ordered) {
      const result = this.generator.generate({
        type,
        target,
        pool,
        translationLanguage,
        seed: `${target.externalId}:${type}`,
        exerciseId,
      });
      if ('exercise' in result) return result;
      lastReason = result.skipped;
    }
    return { skipped: lastReason };
  }

  private async loadPool(language?: string): Promise<GeneratorInsight[]> {
    const filter = language ? { language } : {};
    const insights = await this.insightModel.find(filter).lean().exec();
    return insights.map(toGeneratorInsight);
  }

  private async getSessionOrThrow(sessionId: string): Promise<PracticeSessionDocument> {
    if (!isValidObjectId(sessionId)) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
    const session = await this.sessionModel.findById(sessionId).exec();
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
    return session;
  }

  private toPublicSession(session: PracticeSessionDocument) {
    return {
      sessionId: session.id,
      userId: session.userId,
      status: session.status,
      config: session.config,
      exercises: session.exercises.map(stripAnswer),
      skipped: session.skipped,
    };
  }
}

/** Remove the correct answer before sending an exercise to the client. */
function stripAnswer(e: Exercise) {
  return {
    exerciseId: e.exerciseId,
    type: e.type,
    wordInsightId: e.wordInsightId,
    word: e.word,
    prompt: e.prompt,
    promptLanguage: e.promptLanguage,
    translationLanguage: e.translationLanguage,
    options: e.options,
    answered: e.answered,
  };
}

function toGeneratorInsight(i: {
  externalId: string;
  word: string;
  normalizedWord: string;
  language: string;
  translations: { language: string; text: string }[];
  imageRefs: { id: string; url: string }[];
}): GeneratorInsight {
  return {
    externalId: i.externalId,
    word: i.word,
    normalizedWord: i.normalizedWord,
    language: i.language,
    translations: i.translations ?? [],
    imageRefs: (i.imageRefs ?? []).map((img) => ({ id: img.id, url: img.url })),
  };
}

function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length === 0) return arr;
  const k = by % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}
