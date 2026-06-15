import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WordInsight, WordInsightSchema } from './schemas/word-insight.schema';
import { WordInsightsService } from './word-insights.service';
import { WordInsightsController } from './word-insights.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: WordInsight.name, schema: WordInsightSchema }])],
  controllers: [WordInsightsController],
  providers: [WordInsightsService],
  exports: [WordInsightsService, MongooseModule],
})
export class WordInsightsModule {}
