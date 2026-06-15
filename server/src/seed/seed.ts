import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { WordInsightsService } from '../modules/word-insights/word-insights.service';
import { UserVocabularyService } from '../modules/user-vocabulary/user-vocabulary.service';
import { dataset } from './dataset';

/**
 * Idempotent seed: clears the practice/user collections, upserts the example insights and applies
 * the sample user vocabulary. Run with `npm run seed`.
 */
async function run() {
  const logger = new Logger('seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const connection = app.get<Connection>(getConnectionToken());
  await Promise.all(
    ['word_insights', 'user_vocabulary', 'practice_sessions', 'exercise_attempts'].map((name) =>
      connection.collection(name).deleteMany({}),
    ),
  );

  const insights = app.get(WordInsightsService);
  const vocab = app.get(UserVocabularyService);

  const summary = await insights.import({ wordInsights: dataset.wordInsights });
  logger.log(
    `Insights — created: ${summary.created}, updated: ${summary.updated}, ` +
      `skipped: ${summary.skipped}, rejected: ${summary.rejected.length}`,
  );

  for (const uv of dataset.userVocabulary) {
    await vocab.updateStatus(uv.userId, uv.wordInsightId, uv.status);
  }
  logger.log(`User vocabulary rows applied: ${dataset.userVocabulary.length}`);

  await app.close();
  logger.log('Seed complete.');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
