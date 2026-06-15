import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExerciseAttemptDocument = HydratedDocument<ExerciseAttempt>;

@Schema({ collection: 'exercise_attempts', timestamps: { createdAt: true, updatedAt: false } })
export class ExerciseAttempt {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  sessionId!: string;

  @Prop({ required: true })
  exerciseId!: string;

  @Prop({ required: true })
  wordInsightId!: string;

  @Prop({ required: true })
  word!: string;

  @Prop({ required: true })
  isCorrect!: boolean;

  @Prop({ required: true })
  answer!: string;
}

export const ExerciseAttemptSchema = SchemaFactory.createForClass(ExerciseAttempt);
ExerciseAttemptSchema.index({ sessionId: 1 });
ExerciseAttemptSchema.index({ userId: 1, wordInsightId: 1, createdAt: -1 });
