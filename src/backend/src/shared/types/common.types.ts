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

/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

/**
 * Sort order for list queries.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Utility type representing a value that can be null.
 */
export type Nullable<T> = T | null;
