import { VocabularyStatus } from '../../common/enums';
import { PrioritizationService } from './prioritization.service';

describe('PrioritizationService', () => {
  const service = new PrioritizationService();
  const base = { frequency: 10, difficulty: 2, hasRecentIncorrect: false };

  it('ranks unknown > learning > known for otherwise identical words', () => {
    const unknown = service.score({ ...base, status: VocabularyStatus.UNKNOWN }).priorityScore;
    const learning = service.score({ ...base, status: VocabularyStatus.LEARNING }).priorityScore;
    const known = service.score({ ...base, status: VocabularyStatus.KNOWN }).priorityScore;

    expect(unknown).toBeGreaterThan(learning);
    expect(learning).toBeGreaterThan(known);
  });

  it('boosts words answered incorrectly recently', () => {
    const without = service.score({ ...base, status: VocabularyStatus.LEARNING }).priorityScore;
    const withRecent = service.score({
      ...base,
      status: VocabularyStatus.LEARNING,
      hasRecentIncorrect: true,
    }).priorityScore;

    expect(withRecent).toBeGreaterThan(without);
  });

  it('gives higher priority to more frequent and more difficult words', () => {
    const low = service.score({
      status: VocabularyStatus.UNKNOWN,
      frequency: 1,
      difficulty: 1,
      hasRecentIncorrect: false,
    }).priorityScore;
    const high = service.score({
      status: VocabularyStatus.UNKNOWN,
      frequency: 50,
      difficulty: 5,
      hasRecentIncorrect: false,
    }).priorityScore;

    expect(high).toBeGreaterThan(low);
  });

  it('keeps the score within [0, 1]', () => {
    const max = service.score({
      status: VocabularyStatus.UNKNOWN,
      frequency: 1000,
      difficulty: 5,
      hasRecentIncorrect: true,
    }).priorityScore;
    expect(max).toBeLessThanOrEqual(1);
    expect(max).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic', () => {
    const input = { ...base, status: VocabularyStatus.UNKNOWN };
    expect(service.score(input)).toEqual(service.score(input));
  });

  it('explains the recommendation', () => {
    expect(
      service.score({ ...base, status: VocabularyStatus.UNKNOWN }).recommendationReason,
    ).toMatch(/new word/i);
    expect(service.score({ ...base, status: VocabularyStatus.KNOWN }).recommendationReason).toMatch(
      /known/i,
    );
    expect(
      service.score({
        status: VocabularyStatus.LEARNING,
        frequency: 0,
        difficulty: 1,
        hasRecentIncorrect: true,
      }).recommendationReason,
    ).toMatch(/incorrectly/i);
  });
});
