import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';

const insightsPayload = {
  wordInsights: [
    {
      id: 'insight_001',
      word: 'darling',
      normalizedWord: 'darling',
      language: 'en',
      translations: [{ language: 'es', text: 'cariño' }],
      difficulty: 2,
      frequency: 12,
      imageRefs: [{ id: 'i1', url: 'https://x/darling.png' }],
    },
    {
      id: 'insight_002',
      word: 'love',
      normalizedWord: 'love',
      language: 'en',
      translations: [{ language: 'es', text: 'amor' }],
      difficulty: 1,
      frequency: 35,
      imageRefs: [{ id: 'i2', url: 'https://x/love.png' }],
    },
    {
      id: 'insight_003',
      word: 'fire',
      normalizedWord: 'fire',
      language: 'en',
      translations: [{ language: 'es', text: 'fuego' }],
      difficulty: 2,
      frequency: 18,
      imageRefs: [{ id: 'i3', url: 'https://x/fire.png' }],
    },
    {
      id: 'insight_004',
      word: 'heart',
      normalizedWord: 'heart',
      language: 'en',
      translations: [{ language: 'es', text: 'corazón' }],
      difficulty: 1,
      frequency: 28,
      imageRefs: [{ id: 'i4', url: 'https://x/heart.png' }],
    },
  ],
};

describe('Singit practice API (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let connection: Connection;
  const userId = 'user_e2e';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('singit_e2e');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await mongod?.stop();
  });

  it('imports word insights and reports a summary', async () => {
    const res = await request(app.getHttpServer())
      .post('/word-insights/import')
      .send(insightsPayload)
      .expect(201);
    expect(res.body.created).toBe(4);
    expect(res.body.rejected).toHaveLength(0);
  });

  it('is idempotent on re-import (updates, not duplicates)', async () => {
    const res = await request(app.getHttpServer())
      .post('/word-insights/import')
      .send(insightsPayload)
      .expect(201);
    expect(res.body.created).toBe(0);
    expect(res.body.updated).toBe(4);
  });

  it('lists insights with filters and pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/word-insights?language=en&limit=2')
      .expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items).toHaveLength(2);
  });

  it('returns user word insights with priority scores, ranked', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userId}/word-insights`)
      .expect(200);
    expect(res.body.items.length).toBe(4);
    expect(res.body.items[0]).toHaveProperty('priorityScore');
    expect(res.body.items[0]).toHaveProperty('recommendationReason');
    const scores = res.body.items.map((i: any) => i.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('updates user vocabulary manually', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${userId}/vocabulary/insight_002`)
      .send({ status: 'ignored' })
      .expect(200);
    expect(res.body.status).toBe('ignored');
  });

  it('runs a full practice flow: create -> attempts -> results -> summary', async () => {
    // Create a session (answers hidden in response).
    const created = await request(app.getHttpServer())
      .post(`/users/${userId}/practice-sessions`)
      .send({ limit: 3, sourceLanguage: 'en', translationLanguage: 'es' })
      .expect(201);

    const sessionId = created.body.sessionId;
    expect(created.body.exercises.length).toBeGreaterThan(0);
    expect(created.body.exercises[0]).not.toHaveProperty('correctOptionId');

    // Ignored word (insight_002) must not be selected for practice.
    const practicedIds = created.body.exercises.map((e: any) => e.wordInsightId);
    expect(practicedIds).not.toContain('insight_002');

    // Read correct answers straight from the DB (they are intentionally hidden via the API).
    const sessionDoc: any = await connection
      .collection('practice_sessions')
      .findOne({ _id: new Types.ObjectId(sessionId) });
    const first = sessionDoc.exercises[0];

    // Two correct answers on the same word -> known.
    let attempt = await request(app.getHttpServer())
      .post(`/practice-sessions/${sessionId}/exercises/${first.exerciseId}/attempts`)
      .send({ answer: first.correctOptionId })
      .expect(201);
    expect(attempt.body.isCorrect).toBe(true);
    expect(attempt.body.newStatus).toBe('learning');

    attempt = await request(app.getHttpServer())
      .post(`/practice-sessions/${sessionId}/exercises/${first.exerciseId}/attempts`)
      .send({ answer: first.correctOptionId })
      .expect(201);
    expect(attempt.body.newStatus).toBe('known');

    // An incorrect answer on the second exercise -> learning.
    const second = sessionDoc.exercises[1];
    const wrong = second.options.find((o: any) => o.id !== second.correctOptionId).id;
    attempt = await request(app.getHttpServer())
      .post(`/practice-sessions/${sessionId}/exercises/${second.exerciseId}/attempts`)
      .send({ answer: wrong })
      .expect(201);
    expect(attempt.body.isCorrect).toBe(false);
    expect(attempt.body.newStatus).toBe('learning');

    // Results reflect counts and latest vocab state.
    const results = await request(app.getHttpServer())
      .get(`/practice-sessions/${sessionId}/results`)
      .expect(200);
    expect(results.body.correctCount).toBe(2);
    expect(results.body.incorrectCount).toBe(1);
    expect(results.body.completed.length).toBe(2);

    // Summary aggregates status counts and attempt stats.
    const summary = await request(app.getHttpServer())
      .get(`/users/${userId}/insight-summary`)
      .expect(200);
    expect(summary.body.byStatus.known).toBeGreaterThanOrEqual(1);
    expect(summary.body.attemptStats.totalAttempts).toBe(3);
  });
});
