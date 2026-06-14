import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ExerciseType, VocabularyStatus } from '../../../common/enums';

export class CreatePracticeSessionDto {
  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 5;

  @ApiPropertyOptional({ example: 'en', description: 'Source language of the words to practice.' })
  @IsOptional()
  @IsString()
  sourceLanguage?: string;

  @ApiPropertyOptional({
    example: 'es',
    description: 'Target language for translation-based exercises.',
  })
  @IsOptional()
  @IsString()
  translationLanguage?: string;

  @ApiPropertyOptional({
    enum: VocabularyStatus,
    isArray: true,
    description: 'Vocabulary statuses to draw from. Defaults to unknown + learning.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VocabularyStatus, { each: true })
  statuses?: VocabularyStatus[];

  @ApiPropertyOptional({
    enum: ExerciseType,
    isArray: true,
    description: 'Exercise types to generate. Defaults to all supported types.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ExerciseType, { each: true })
  exerciseTypes?: ExerciseType[];
}

export class SubmitAttemptDto {
  @ApiProperty({ example: 'opt_2', description: 'The id of the chosen option.' })
  @IsString()
  answer!: string;
}
