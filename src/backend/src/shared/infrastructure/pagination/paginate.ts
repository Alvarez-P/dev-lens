import { PaginationQueryDto } from './pagination.dto';
import { PaginatedResult } from './paginated-result';

/**
 * Options for the paginate utility function.
 */
export interface PaginateOptions<T> {
  /** The full dataset to paginate */
  data: T[];
  /** Pagination query parameters */
  query: PaginationQueryDto;
  /** Optional filter function to apply before pagination */
  filter?: (item: T) => boolean;
  /** Optional sort function to apply before pagination */
  sort?: (a: T, b: T) => number;
}

/**
 * Utility function that paginates an array of data.
 * Applies optional filtering and sorting before pagination.
 *
 * @example
 * ```typescript
 * const result = paginate({
 *   data: allUsers,
 *   query: { page: 1, limit: 20 },
 *   sort: (a, b) => a.name.localeCompare(b.name),
 * });
 * ```
 */
export function paginate<T>(options: PaginateOptions<T>): PaginatedResult<T> {
  const { data, query, filter, sort } = options;
  const { page = 1, limit = 20 } = query;

  // Apply optional filter
  const filtered = filter ? data.filter(filter) : [...data];

  // Apply optional sort
  if (sort) {
    filtered.sort(sort);
  }

  // Paginate
  const startIndex = (page - 1) * limit;
  const paginatedData = filtered.slice(startIndex, startIndex + limit);

  return new PaginatedResult(paginatedData, filtered.length, page, limit);
}
