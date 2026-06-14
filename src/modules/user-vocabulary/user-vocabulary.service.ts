import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VocabularyStatus } from '../../common/enums';
import { WordInsight, WordInsightDocument } from '../word-insights/schemas/word-insight.schema';
import { UserVocabulary, UserVocabularyDocument } from './schemas/user-vocabulary.schema';
import { PrioritizationService } from './prioritization.service';
import { QueryUserWordInsightsDto } from './dto/user-vocabulary.dto';

export type WordInsightLean = WordInsight & { _id: unknown };

/** A global insight ranked for a user, carrying the full insight doc + computed state. */
export interface RankedInsight {
  insight: WordInsightLean;
  vocab?: UserVocabularyDocument;
  status: VocabularyStatus;
  priorityScore: number;
  recommendationReason: string;
}

/** Public-facing shape returned by "Get User Word Insights". */
export interface UserWordInsight {
  wordInsightId: string;
  word: string;
  normalizedWord: string;
  language: string;
  difficulty: number;
  frequency: number;
  translations: { language: string; text: string }[];
  status: VocabularyStatus;
  correctCount: number;
  incorrectCount: number;
  lastPracticedAt: Date | null;
  priorityScore: number;
  recommendationReason: string;
}

export interface RankOptions {
  language?: string;
  difficulty?: number;
  statuses?: VocabularyStatus[];
}

@Injectable()
export class UserVocabularyService {
  constructor(
    @InjectModel(WordInsight.name)
    private readonly insightModel: Model<WordInsightDocument>,
    @InjectModel(UserVocabulary.name)
    private readonly vocabModel: Model<UserVocabularyDocument>,
    private readonly prioritization: PrioritizationService,
  ) {}

  /**
   * Core ranking: combine the filtered catalog with the user's vocabulary state and sort by
   * descending priority (deterministic tie-break by normalizedWord). Returns the full insight docs
   * so callers (e.g. the practice layer) can build exercises without re-querying.
   *
   * The merge runs in-memory over the filtered catalog (bounded for this challenge). For a very
   * large catalog this would become a materialized per-user view; the scoring stays identical.
   */
  async rankInsightsForUser(userId: string, opts: RankOptions = {}): Promise<RankedInsight[]> {
    const filter: Record<string, unknown> = {};
    if (opts.language) filter.language = opts.language;
    if (opts.difficulty) filter.difficulty = opts.difficulty;

    const insights = (await this.insightModel.find(filter).lean().exec()) as WordInsightLean[];
    const vocabMap = await this.loadVocabMap(
      userId,
      insights.map((i) => i.externalId),
    );

    let ranked: RankedInsight[] = insights.map((insight) => {
      const vocab = vocabMap.get(insight.externalId);
      const status = vocab?.status ?? VocabularyStatus.UNKNOWN;
      const { priorityScore, recommendationReason } = this.prioritization.score({
        status,
        frequency: insight.frequency,
        difficulty: insight.difficulty,
        hasRecentIncorrect: vocab?.lastAttemptCorrect === false,
      });
      return { insight, vocab, status, priorityScore, recommendationReason };
    });

    if (opts.statuses && opts.statuses.length > 0) {
      const allowed = new Set(opts.statuses);
      ranked = ranked.filter((r) => allowed.has(r.status));
    }

    ranked.sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        a.insight.normalizedWord.localeCompare(b.insight.normalizedWord),
    );
    return ranked;
  }

  /** "Get User Word Insights": ranked, formatted and paginated. */
  async getUserWordInsights(
    userId: string,
    query: QueryUserWordInsightsDto,
  ): Promise<{ total: number; limit: number; offset: number; items: UserWordInsight[] }> {
    const ranked = await this.rankInsightsForUser(userId, {
      language: query.language,
      difficulty: query.difficulty,
      statuses: query.status ? [query.status] : undefined,
    });

    const items = ranked.slice(query.offset, query.offset + query.limit).map((r) => this.format(r));
    return { total: ranked.length, limit: query.limit, offset: query.offset, items };
  }

  /** Manually set a user's status for an insight; returns the persisted state. */
  async updateStatus(
    userId: string,
    wordInsightId: string,
    status: VocabularyStatus,
  ): Promise<UserVocabularyDocument> {
    const insight = await this.insightModel.findOne({ externalId: wordInsightId }).lean().exec();
    if (!insight) {
      throw new NotFoundException(`Word insight '${wordInsightId}' not found`);
    }

    return this.vocabModel
      .findOneAndUpdate(
        { userId, wordInsightId },
        {
          $set: { status },
          $setOnInsert: {
            normalizedWord: insight.normalizedWord,
            language: insight.language,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  /**
   * Apply an exercise attempt outcome to the user's vocabulary (documented rule):
   *  - correct   -> correctCount++, status becomes `known` once correctCount >= 2, else `learning`
   *  - incorrect -> incorrectCount++, status becomes `learning`
   *  - `ignored` is preserved; `lastPracticedAt`/`lastAttemptCorrect` are always updated.
   * Returns previous and new status.
   */
  async applyAttemptOutcome(
    userId: string,
    insight: Pick<WordInsight, 'externalId' | 'normalizedWord' | 'language'>,
    isCorrect: boolean,
  ): Promise<{ previousStatus: VocabularyStatus; newStatus: VocabularyStatus }> {
    const existing = await this.vocabModel
      .findOne({ userId, wordInsightId: insight.externalId })
      .exec();

    const previousStatus = existing?.status ?? VocabularyStatus.UNKNOWN;
    const correctCount = (existing?.correctCount ?? 0) + (isCorrect ? 1 : 0);
    const incorrectCount = (existing?.incorrectCount ?? 0) + (isCorrect ? 0 : 1);
    const newStatus = UserVocabularyService.computeNextStatus(
      previousStatus,
      correctCount,
      isCorrect,
    );

    await this.vocabModel
      .findOneAndUpdate(
        { userId, wordInsightId: insight.externalId },
        {
          $set: {
            status: newStatus,
            correctCount,
            incorrectCount,
            lastPracticedAt: new Date(),
            lastAttemptCorrect: isCorrect,
          },
          $setOnInsert: {
            normalizedWord: insight.normalizedWord,
            language: insight.language,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    return { previousStatus, newStatus };
  }

  /** Pure state-transition rule — extracted so it is trivially unit-testable. */
  static computeNextStatus(
    previous: VocabularyStatus,
    correctCount: number,
    isCorrect: boolean,
  ): VocabularyStatus {
    if (previous === VocabularyStatus.IGNORED) return VocabularyStatus.IGNORED;
    if (!isCorrect) return VocabularyStatus.LEARNING;
    return correctCount >= 2 ? VocabularyStatus.KNOWN : VocabularyStatus.LEARNING;
  }

  /** Latest persisted state for a set of insight ids (used by session results). */
  async getStates(userId: string, wordInsightIds: string[]) {
    return this.vocabModel
      .find({ userId, wordInsightId: { $in: wordInsightIds } })
      .lean()
      .exec();
  }

  /** Counts by status, aggregate attempt stats, and top recommended words. */
  async getSummary(userId: string) {
    const [totalInsights, vocabRows] = await Promise.all([
      this.insightModel.countDocuments().exec(),
      this.vocabModel.find({ userId }).lean().exec(),
    ]);

    const byStatus: Record<VocabularyStatus, number> = {
      [VocabularyStatus.UNKNOWN]: 0,
      [VocabularyStatus.LEARNING]: 0,
      [VocabularyStatus.KNOWN]: 0,
      [VocabularyStatus.IGNORED]: 0,
    };
    let totalCorrect = 0;
    let totalIncorrect = 0;
    for (const row of vocabRows) {
      byStatus[row.status]++;
      totalCorrect += row.correctCount;
      totalIncorrect += row.incorrectCount;
    }
    // Insights the user has never interacted with are effectively unknown.
    byStatus[VocabularyStatus.UNKNOWN] += Math.max(0, totalInsights - vocabRows.length);

    const totalAttempts = totalCorrect + totalIncorrect;
    const ranked = await this.rankInsightsForUser(userId, {
      statuses: [VocabularyStatus.UNKNOWN, VocabularyStatus.LEARNING],
    });

    return {
      userId,
      totalInsights,
      byStatus,
      attemptStats: {
        totalAttempts,
        totalCorrect,
        totalIncorrect,
        accuracy: totalAttempts === 0 ? null : round(totalCorrect / totalAttempts),
      },
      recommendedWords: ranked.slice(0, 5).map((r) => ({
        wordInsightId: r.insight.externalId,
        word: r.insight.word,
        priorityScore: r.priorityScore,
        recommendationReason: r.recommendationReason,
      })),
    };
  }

  private async loadVocabMap(
    userId: string,
    wordInsightIds: string[],
  ): Promise<Map<string, UserVocabularyDocument>> {
    const rows = await this.vocabModel
      .find({ userId, wordInsightId: { $in: wordInsightIds } })
      .exec();
    return new Map(rows.map((r) => [r.wordInsightId, r]));
  }

  private format(r: RankedInsight): UserWordInsight {
    return {
      wordInsightId: r.insight.externalId,
      word: r.insight.word,
      normalizedWord: r.insight.normalizedWord,
      language: r.insight.language,
      difficulty: r.insight.difficulty,
      frequency: r.insight.frequency,
      translations: r.insight.translations,
      status: r.status,
      correctCount: r.vocab?.correctCount ?? 0,
      incorrectCount: r.vocab?.incorrectCount ?? 0,
      lastPracticedAt: r.vocab?.lastPracticedAt ?? null,
      priorityScore: r.priorityScore,
      recommendationReason: r.recommendationReason,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
