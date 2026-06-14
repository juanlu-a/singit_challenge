import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { WordInsightsModule } from './modules/word-insights/word-insights.module';
import { UserVocabularyModule } from './modules/user-vocabulary/user-vocabulary.module';
import { PracticeModule } from './modules/practice/practice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    WordInsightsModule,
    UserVocabularyModule,
    PracticeModule,
  ],
})
export class AppModule {}
