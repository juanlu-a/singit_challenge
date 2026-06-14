import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WordInsightsModule } from '../word-insights/word-insights.module';
import { UserVocabulary, UserVocabularySchema } from './schemas/user-vocabulary.schema';
import { UserVocabularyService } from './user-vocabulary.service';
import { UserVocabularyController } from './user-vocabulary.controller';
import { PrioritizationService } from './prioritization.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserVocabulary.name, schema: UserVocabularySchema }]),
    WordInsightsModule, // provides the WordInsight model
  ],
  controllers: [UserVocabularyController],
  providers: [UserVocabularyService, PrioritizationService],
  exports: [UserVocabularyService, PrioritizationService, MongooseModule],
})
export class UserVocabularyModule {}
