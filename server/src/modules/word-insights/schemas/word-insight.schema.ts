import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { InsightSource } from '../../../common/enums';

export type WordInsightDocument = HydratedDocument<WordInsight>;

@Schema({ _id: false })
export class Translation {
  @Prop({ required: true })
  language!: string;

  @Prop({ required: true })
  text!: string;
}
const TranslationSchema = SchemaFactory.createForClass(Translation);

@Schema({ _id: false })
export class SongRef {
  @Prop({ required: true })
  songId!: string;

  @Prop()
  title?: string;

  @Prop({ default: 1 })
  occurrences!: number;
}
const SongRefSchema = SchemaFactory.createForClass(SongRef);

@Schema({ _id: false })
export class ImageRef {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  url!: string;

  @Prop()
  alt?: string;
}
const ImageRefSchema = SchemaFactory.createForClass(ImageRef);

@Schema({ _id: false })
export class Example {
  @Prop({ required: true })
  text!: string;

  @Prop({ type: [TranslationSchema], default: [] })
  translations!: Translation[];
}
const ExampleSchema = SchemaFactory.createForClass(Example);

@Schema({ collection: 'word_insights', timestamps: true })
export class WordInsight {
  /**
   * Stable external id (e.g. "insight_001"). We keep it distinct from Mongo's _id so imports are
   * idempotent against the source dataset and references from other collections stay readable.
   */
  @Prop({ required: true })
  externalId!: string;

  @Prop({ required: true })
  word!: string;

  @Prop({ required: true })
  normalizedWord!: string;

  @Prop({ required: true })
  language!: string;

  @Prop({ type: [TranslationSchema], default: [] })
  translations!: Translation[];

  @Prop({ required: true, min: 1, max: 5, default: 1 })
  difficulty!: number;

  @Prop({ required: true, min: 0, default: 0 })
  frequency!: number;

  @Prop({ enum: InsightSource, default: InsightSource.SONG })
  source!: InsightSource;

  @Prop({ type: [SongRefSchema], default: [] })
  songRefs!: SongRef[];

  @Prop({ type: [ImageRefSchema], default: [] })
  imageRefs!: ImageRef[];

  @Prop({ type: [ExampleSchema], default: [] })
  examples!: Example[];
}

export const WordInsightSchema = SchemaFactory.createForClass(WordInsight);

// Natural upsert / join key (Part 1 §7). A normalized word is unique per language.
WordInsightSchema.index({ normalizedWord: 1, language: 1 }, { unique: true });
// External id is also unique so dataset re-imports are idempotent.
WordInsightSchema.index({ externalId: 1 }, { unique: true });
// Catalog filtering (Get Word Insights).
WordInsightSchema.index({ language: 1, source: 1, difficulty: 1 });
