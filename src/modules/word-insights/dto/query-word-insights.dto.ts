import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { InsightSource } from '../../../common/enums';

export class QueryWordInsightsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ enum: InsightSource })
  @IsOptional()
  @IsEnum(InsightSource)
  source?: InsightSource;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ example: 'darling' })
  @IsOptional()
  @IsString()
  normalizedWord?: string;
}
