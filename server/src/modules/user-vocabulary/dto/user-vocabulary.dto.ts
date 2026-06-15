import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { VocabularyStatus } from '../../../common/enums';

export class UpdateUserVocabularyDto {
  @ApiProperty({ enum: VocabularyStatus, example: VocabularyStatus.LEARNING })
  @IsEnum(VocabularyStatus)
  status!: VocabularyStatus;
}

export class QueryUserWordInsightsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ enum: VocabularyStatus })
  @IsOptional()
  @IsEnum(VocabularyStatus)
  status?: VocabularyStatus;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;
}
