import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserVocabularyService } from './user-vocabulary.service';
import { QueryUserWordInsightsDto, UpdateUserVocabularyDto } from './dto/user-vocabulary.dto';

@ApiTags('user-vocabulary')
@Controller('users/:userId')
export class UserVocabularyController {
  constructor(private readonly service: UserVocabularyService) {}

  @Get('word-insights')
  @ApiOperation({
    summary: 'Get user word insights',
    description:
      'Global insights combined with the user vocabulary state, practice stats, priority score ' +
      'and recommendation reason. Sorted by priority (desc).',
  })
  getUserWordInsights(@Param('userId') userId: string, @Query() query: QueryUserWordInsightsDto) {
    return this.service.getUserWordInsights(userId, query);
  }

  @Put('vocabulary/:wordInsightId')
  @ApiOperation({
    summary: 'Update user vocabulary status',
    description: 'Manually set the knowledge status for a word insight; returns the updated state.',
  })
  updateVocabulary(
    @Param('userId') userId: string,
    @Param('wordInsightId') wordInsightId: string,
    @Body() dto: UpdateUserVocabularyDto,
  ) {
    return this.service.updateStatus(userId, wordInsightId, dto.status);
  }

  @Get('insight-summary')
  @ApiOperation({
    summary: 'Get user insight summary',
    description:
      'Counts by status, aggregate attempt stats, and top recommended words to practice.',
  })
  getSummary(@Param('userId') userId: string) {
    return this.service.getSummary(userId);
  }
}
