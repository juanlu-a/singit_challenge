import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { VocabularyStatus } from '../../../common/enums';

export type UserVocabularyDocument = HydratedDocument<UserVocabulary>;

/**
 * Per-user knowledge state for a single word insight. Stored separately from the global catalog
 * (Part 1 §2.4) so user writes scale independently and the catalog stays immutable/cacheable.
 *
 * `wordInsightId` references `WordInsight.externalId` (the stable, human-readable id) so the
 * dataset, attempts and vocabulary all line up on the same key.
 */
@Schema({ collection: 'user_vocabulary', timestamps: true })
export class UserVocabulary {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  wordInsightId!: string;

  @Prop({ required: true })
  normalizedWord!: string;

  @Prop({ required: true })
  language!: string;

  @Prop({ enum: VocabularyStatus, default: VocabularyStatus.UNKNOWN })
  status!: VocabularyStatus;

  @Prop({ default: 0 })
  correctCount!: number;

  @Prop({ default: 0 })
  incorrectCount!: number;

  @Prop({ type: Date, default: null })
  lastPracticedAt!: Date | null;

  /** Result of the most recent attempt; powers the "answered incorrectly recently" priority term. */
  @Prop({ type: Boolean, default: null })
  lastAttemptCorrect!: boolean | null;
}

export const UserVocabularySchema = SchemaFactory.createForClass(UserVocabulary);

// One state per user per insight; also the upsert key (Part 1 §7).
UserVocabularySchema.index({ userId: 1, wordInsightId: 1 }, { unique: true });
// Summary counts by status.
UserVocabularySchema.index({ userId: 1, status: 1 });
