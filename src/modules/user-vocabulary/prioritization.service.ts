import { Injectable } from '@nestjs/common';
import { VocabularyStatus } from '../../common/enums';

export interface PrioritizationInput {
  status: VocabularyStatus;
  frequency: number;
  difficulty: number; // 1..5
  hasRecentIncorrect: boolean;
}

export interface PrioritizationResult {
  priorityScore: number; // 0..1, higher = practice sooner
  recommendationReason: string;
}

/**
 * Deterministic practice prioritization (documented in README).
 *
 *   priority = wStatus·statusWeight
 *            + wFreq·normFrequency
 *            + wDiff·normDifficulty
 *            + wRecentWrong·recentIncorrectFlag
 *
 * Weights sum to 1 so the score stays in [0, 1]. `ignored` and `known` words contribute 0 from
 * status; `ignored` words are filtered out upstream before scoring. Pure function — no I/O — so it
 * is trivial to unit test.
 */
@Injectable()
export class PrioritizationService {
  static readonly WEIGHTS = { status: 0.5, frequency: 0.2, difficulty: 0.2, recentIncorrect: 0.1 };
  static readonly FREQUENCY_CAP = 50;

  private static readonly STATUS_WEIGHT: Record<VocabularyStatus, number> = {
    [VocabularyStatus.UNKNOWN]: 1,
    [VocabularyStatus.LEARNING]: 0.7,
    [VocabularyStatus.KNOWN]: 0,
    [VocabularyStatus.IGNORED]: 0,
  };

  score(input: PrioritizationInput): PrioritizationResult {
    const w = PrioritizationService.WEIGHTS;
    const statusWeight = PrioritizationService.STATUS_WEIGHT[input.status];
    const normFrequency =
      Math.min(input.frequency, PrioritizationService.FREQUENCY_CAP) /
      PrioritizationService.FREQUENCY_CAP;
    const normDifficulty = (this.clampDifficulty(input.difficulty) - 1) / 4;
    const recentFlag = input.hasRecentIncorrect ? 1 : 0;

    const contributions = {
      status: w.status * statusWeight,
      frequency: w.frequency * normFrequency,
      difficulty: w.difficulty * normDifficulty,
      recentIncorrect: w.recentIncorrect * recentFlag,
    };

    const priorityScore = round(
      contributions.status +
        contributions.frequency +
        contributions.difficulty +
        contributions.recentIncorrect,
    );

    return { priorityScore, recommendationReason: this.reason(contributions, input) };
  }

  /**
   * Human-readable reason derived from the dominant contributing term. Tie-break order is fixed
   * (recentIncorrect > status > frequency > difficulty) so the reason is deterministic.
   */
  private reason(
    contributions: Record<'status' | 'frequency' | 'difficulty' | 'recentIncorrect', number>,
    input: PrioritizationInput,
  ): string {
    if (input.status === VocabularyStatus.KNOWN) return 'Already known — low practice priority';
    // A recent mistake is the most actionable reason to resurface a word, even if its numeric
    // weight is small, so it takes precedence in the explanation.
    if (input.hasRecentIncorrect) return 'Recently answered incorrectly';

    const order: Array<keyof typeof contributions> = [
      'recentIncorrect',
      'status',
      'frequency',
      'difficulty',
    ];
    let dominant = order[0];
    for (const key of order) {
      if (contributions[key] > contributions[dominant]) dominant = key;
    }

    switch (dominant) {
      case 'recentIncorrect':
        return 'Recently answered incorrectly';
      case 'status':
        return input.status === VocabularyStatus.UNKNOWN
          ? 'New word you have not learned yet'
          : 'Still learning this word';
      case 'frequency':
        return 'Appears frequently across songs';
      case 'difficulty':
        return 'A challenging word worth practicing';
    }
  }

  private clampDifficulty(d: number): number {
    return Math.max(1, Math.min(5, d));
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
