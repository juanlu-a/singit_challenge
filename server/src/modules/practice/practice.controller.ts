import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PracticeService } from './practice.service';
import { CreatePracticeSessionDto, SubmitAttemptDto } from './dto/practice.dto';

@ApiTags('practice')
@Controller()
export class PracticeController {
  constructor(private readonly service: PracticeService) {}

  @Post('users/:userId/practice-sessions')
  @ApiOperation({
    summary: 'Create a practice session',
    description:
      'Generates exercises from prioritized word insights based on limit, source/translation ' +
      'language, statuses and exercise types. Correct answers are not included in the response.',
  })
  createSession(@Param('userId') userId: string, @Body() dto: CreatePracticeSessionDto) {
    return this.service.createSession(userId, dto);
  }

  @Get('practice-sessions/:sessionId')
  @ApiOperation({ summary: 'Get a practice session (answers hidden)' })
  getSession(@Param('sessionId') sessionId: string) {
    return this.service.getSession(sessionId);
  }

  @Post('practice-sessions/:sessionId/exercises/:exerciseId/attempts')
  @ApiOperation({
    summary: 'Submit an exercise attempt',
    description:
      'Validates correctness, stores the attempt, updates the user vocabulary and returns the ' +
      'previous and new vocabulary status.',
  })
  submitAttempt(
    @Param('sessionId') sessionId: string,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.service.submitAttempt(sessionId, exerciseId, dto);
  }

  @Get('practice-sessions/:sessionId/results')
  @ApiOperation({
    summary: 'Get practice session results',
    description:
      'Completed and pending exercises, correct/incorrect counts, and latest vocabulary state ' +
      'for the practiced words.',
  })
  getResults(@Param('sessionId') sessionId: string) {
    return this.service.getResults(sessionId);
  }
}
