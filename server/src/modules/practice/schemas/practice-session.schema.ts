import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ExerciseType, VocabularyStatus } from '../../../common/enums';

export type PracticeSessionDocument = HydratedDocument<PracticeSession>;

@Schema({ _id: false })
export class ExerciseOption {
  @Prop({ required: true })
  id!: string; // e.g. "opt_0"

  @Prop()
  value?: string; // text label (word / translation)

  @Prop()
  imageUrl?: string; // for word_to_image
}
const ExerciseOptionSchema = SchemaFactory.createForClass(ExerciseOption);

@Schema({ _id: false })
export class Exercise {
  @Prop({ required: true })
  exerciseId!: string;

  @Prop({ enum: ExerciseType, required: true })
  type!: ExerciseType;

  @Prop({ required: true })
  wordInsightId!: string;

  @Prop({ required: true })
  word!: string;

  @Prop({ required: true })
  prompt!: string;

  @Prop({ required: true })
  promptLanguage!: string;

  @Prop()
  translationLanguage?: string;

  @Prop({ type: [ExerciseOptionSchema], required: true })
  options!: ExerciseOption[];

  /** Hidden from clients until the exercise is answered (stripped in controller responses). */
  @Prop({ required: true })
  correctOptionId!: string;

  @Prop({ default: false })
  answered!: boolean;
}
const ExerciseSchema = SchemaFactory.createForClass(Exercise);

@Schema({ _id: false })
export class SessionConfig {
  @Prop({ required: true })
  limit!: number;

  @Prop()
  sourceLanguage?: string;

  @Prop()
  translationLanguage?: string;

  @Prop({ type: [String], default: [] })
  statuses!: VocabularyStatus[];

  @Prop({ type: [String], default: [] })
  exerciseTypes!: ExerciseType[];
}
const SessionConfigSchema = SchemaFactory.createForClass(SessionConfig);

@Schema({ collection: 'practice_sessions', timestamps: true })
export class PracticeSession {
  @Prop({ required: true })
  userId!: string;

  @Prop({ type: SessionConfigSchema, required: true })
  config!: SessionConfig;

  @Prop({ type: [ExerciseSchema], default: [] })
  exercises!: Exercise[];

  /** Words that were eligible but skipped (insufficient data), for transparency. */
  @Prop({ type: [Object], default: [] })
  skipped!: { wordInsightId: string; reason: string }[];

  @Prop({ default: 'active' })
  status!: 'active' | 'completed';
}

export const PracticeSessionSchema = SchemaFactory.createForClass(PracticeSession);
PracticeSessionSchema.index({ userId: 1, createdAt: -1 });
