import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WordInsightsService } from './word-insights.service';
import { ImportSummaryDto, ImportWordInsightsDto } from './dto/word-insight.dto';
import { QueryWordInsightsDto } from './dto/query-word-insights.dto';

@ApiTags('word-insights')
@Controller('word-insights')
export class WordInsightsController {
  constructor(private readonly service: WordInsightsService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Import / upsert global word insights',
    description:
      'Upserts by (normalizedWord, language). Returns a summary of created, updated, skipped ' +
      'and rejected records. Invalid records are rejected individually, never failing the batch.',
  })
  import(@Body() dto: ImportWordInsightsDto): Promise<ImportSummaryDto> {
    return this.service.import(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List global word insights',
    description: 'Filter by language, source, difficulty, normalizedWord. Paginated.',
  })
  find(@Query() query: QueryWordInsightsDto) {
    return this.service.find(query);
  }
}
