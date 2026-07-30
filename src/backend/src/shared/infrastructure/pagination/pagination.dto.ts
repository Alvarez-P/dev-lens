import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Standard pagination query parameters for list endpoints.
 * All fields are optional with sensible defaults.
 */
export class PaginationQueryDto {
  /**
   * Page number (1-indexed).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * Number of items per page.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /**
   * Optional sort field (e.g., 'createdAt:asc', 'name:desc').
   * Format: `field:direction`
   */
  @IsOptional()
  @IsString()
  sort?: string;
}
