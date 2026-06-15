import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { normalizeWord } from '../../common/util/normalize';
import { InsightSource } from '../../common/enums';
import { WordInsight, WordInsightDocument } from './schemas/word-insight.schema';
import {
  ImportSummaryDto,
  ImportWordInsightsDto,
  WordInsightInputDto,
} from './dto/word-insight.dto';
import { QueryWordInsightsDto } from './dto/query-word-insights.dto';

@Injectable()
export class WordInsightsService {
  constructor(
    @InjectModel(WordInsight.name)
    private readonly model: Model<WordInsightDocument>,
  ) {}

  /**
   * Import / upsert global insights.
   *
   * Upsert key is the natural `(normalizedWord, language)` pair. We report each record as:
   *  - created  : inserted a new insight
   *  - updated  : matched an existing insight and overwrote it
   *  - skipped  : a duplicate `(normalizedWord, language)` already handled earlier in this batch
   *  - rejected : failed business validation (collected with index + reason, never throws the batch)
   */
  async import(dto: ImportWordInsightsDto): Promise<ImportSummaryDto> {
    const summary: ImportSummaryDto = { created: 0, updated: 0, skipped: 0, rejected: [] };
    const seen = new Set<string>();

    for (let index = 0; index < dto.wordInsights.length; index++) {
      const raw = dto.wordInsights[index];
      const reason = this.validateBusinessRules(raw);
      if (reason) {
        summary.rejected.push({ index, reason });
        continue;
      }

      const normalizedWord = raw.normalizedWord?.trim()
        ? normalizeWord(raw.normalizedWord)
        : normalizeWord(raw.word);
      const key = `${normalizedWord}::${raw.language}`;
      if (seen.has(key)) {
        summary.skipped++;
        continue;
      }
      seen.add(key);

      // externalId is set only on insert so it stays stable across re-imports; the rest is
      // overwritten. (Setting it in both $set and $setOnInsert would conflict in MongoDB.)
      const { externalId, ...mutableFields } = this.toDocument(raw, normalizedWord);
      const result = await this.model.updateOne(
        { normalizedWord, language: raw.language },
        { $set: mutableFields, $setOnInsert: { externalId } },
        { upsert: true },
      );

      if (result.upsertedCount && result.upsertedCount > 0) {
        summary.created++;
      } else {
        summary.updated++;
      }
    }

    return summary;
  }

  /** Paginated, filtered catalog read. */
  async find(query: QueryWordInsightsDto) {
    const filter: Record<string, unknown> = {};
    if (query.language) filter.language = query.language;
    if (query.source) filter.source = query.source;
    if (query.difficulty) filter.difficulty = query.difficulty;
    if (query.normalizedWord) filter.normalizedWord = normalizeWord(query.normalizedWord);

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ normalizedWord: 1, language: 1 })
        .skip(query.offset)
        .limit(query.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { total, limit: query.limit, offset: query.offset, items };
  }

  private validateBusinessRules(raw: WordInsightInputDto): string | null {
    const normalized = raw.normalizedWord?.trim()
      ? normalizeWord(raw.normalizedWord)
      : normalizeWord(raw.word);
    if (!normalized) return 'normalizedWord resolves to empty after normalization';
    if (!raw.translations || raw.translations.length === 0) {
      return 'at least one translation is required';
    }
    return null;
  }

  private toDocument(raw: WordInsightInputDto, normalizedWord: string): Partial<WordInsight> {
    return {
      externalId: raw.id ?? `insight_${normalizedWord}_${raw.language}`,
      word: raw.word,
      normalizedWord,
      language: raw.language,
      translations: raw.translations,
      difficulty: raw.difficulty,
      frequency: raw.frequency,
      source: raw.source ?? InsightSource.SONG,
      songRefs: (raw.songRefs ?? []).map((s) => ({ ...s, occurrences: s.occurrences ?? 1 })),
      imageRefs: raw.imageRefs ?? [],
      examples: (raw.examples ?? []).map((e) => ({ ...e, translations: e.translations ?? [] })),
    };
  }
}
