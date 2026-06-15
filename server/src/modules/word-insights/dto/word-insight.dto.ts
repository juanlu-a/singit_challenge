import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { InsightSource } from '../../../common/enums';

export class TranslationDto {
  @ApiProperty({ example: 'es' })
  @IsString()
  language!: string;

  @ApiProperty({ example: 'cariño' })
  @IsString()
  text!: string;
}

export class SongRefDto {
  @ApiProperty({ example: 'song_001' })
  @IsString()
  songId!: string;

  @ApiPropertyOptional({ example: 'Example Song' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  occurrences?: number;
}

export class ImageRefDto {
  @ApiProperty({ example: 'image_darling_001' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'https://example.com/images/darling.png' })
  @IsString()
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt?: string;
}

export class ExampleDto {
  @ApiProperty({ example: 'Darling, just dive right in' })
  @IsString()
  text!: string;

  @ApiPropertyOptional({ type: [TranslationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations?: TranslationDto[];
}

/** A single word insight as received by the import endpoint. */
export class WordInsightInputDto {
  @ApiPropertyOptional({ example: 'insight_001', description: 'Stable external id (optional).' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'darling' })
  @IsString()
  word!: string;

  @ApiPropertyOptional({
    example: 'darling',
    description: 'Lemma. Defaults to a normalized form of `word` when omitted.',
  })
  @IsOptional()
  @IsString()
  normalizedWord?: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  language!: string;

  @ApiProperty({ type: [TranslationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];

  @ApiProperty({ example: 2, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty!: number;

  @ApiProperty({ example: 12, minimum: 0 })
  @IsInt()
  @Min(0)
  frequency!: number;

  @ApiPropertyOptional({ enum: InsightSource, default: InsightSource.SONG })
  @IsOptional()
  @IsEnum(InsightSource)
  source?: InsightSource;

  @ApiPropertyOptional({ type: [SongRefDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SongRefDto)
  songRefs?: SongRefDto[];

  @ApiPropertyOptional({ type: [ImageRefDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageRefDto)
  imageRefs?: ImageRefDto[];

  @ApiPropertyOptional({ type: [ExampleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDto)
  examples?: ExampleDto[];
}

export class ImportWordInsightsDto {
  @ApiProperty({ type: [WordInsightInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordInsightInputDto)
  wordInsights!: WordInsightInputDto[];
}

export class ImportSummaryDto {
  @ApiProperty() created!: number;
  @ApiProperty() updated!: number;
  @ApiProperty() skipped!: number;
  @ApiProperty({ type: [Object] })
  rejected!: { index: number; reason: string }[];
}
