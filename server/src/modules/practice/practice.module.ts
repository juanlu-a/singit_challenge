import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WordInsightsModule } from '../word-insights/word-insights.module';
import { UserVocabularyModule } from '../user-vocabulary/user-vocabulary.module';
import { PracticeSession, PracticeSessionSchema } from './schemas/practice-session.schema';
import { ExerciseAttempt, ExerciseAttemptSchema } from './schemas/exercise-attempt.schema';
import { PracticeService } from './practice.service';
import { PracticeController } from './practice.controller';
import { ExerciseGeneratorService } from './exercise-generator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PracticeSession.name, schema: PracticeSessionSchema },
      { name: ExerciseAttempt.name, schema: ExerciseAttemptSchema },
    ]),
    WordInsightsModule, // WordInsight model
    UserVocabularyModule, // UserVocabularyService (ranking + attempt outcome)
  ],
  controllers: [PracticeController],
  providers: [PracticeService, ExerciseGeneratorService],
  exports: [ExerciseGeneratorService],
})
export class PracticeModule {}
