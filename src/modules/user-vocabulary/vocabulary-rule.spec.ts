import { VocabularyStatus } from '../../common/enums';
import { UserVocabularyService } from './user-vocabulary.service';

const next = UserVocabularyService.computeNextStatus;

describe('UserVocabularyService.computeNextStatus (attempt rule)', () => {
  it('moves an unknown word to learning after one correct answer', () => {
    expect(next(VocabularyStatus.UNKNOWN, 1, true)).toBe(VocabularyStatus.LEARNING);
  });

  it('marks a word known after two correct answers', () => {
    expect(next(VocabularyStatus.LEARNING, 2, true)).toBe(VocabularyStatus.KNOWN);
  });

  it('moves a word back to learning after an incorrect answer', () => {
    expect(next(VocabularyStatus.KNOWN, 5, false)).toBe(VocabularyStatus.LEARNING);
  });

  it('preserves ignored regardless of the answer', () => {
    expect(next(VocabularyStatus.IGNORED, 3, true)).toBe(VocabularyStatus.IGNORED);
    expect(next(VocabularyStatus.IGNORED, 0, false)).toBe(VocabularyStatus.IGNORED);
  });
});
