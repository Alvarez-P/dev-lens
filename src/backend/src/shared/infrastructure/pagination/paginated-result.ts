/**
 * Generic paginated result wrapper.
 * Contains the data array and pagination metadata.
 */
export class PaginatedResult<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

/**
 * Pagination metadata included in every paginated response.
 */
export interface PaginationMeta {
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
}
