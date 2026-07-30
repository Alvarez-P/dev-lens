import { PaginationQueryDto } from './pagination.dto';
import { PaginatedResult } from './paginated-result';

export interface PaginateOptions<T> {
  data: T[];

  query: PaginationQueryDto;

  filter?: (item: T) => boolean;

  sort?: (a: T, b: T) => number;
}

export function paginate<T>(options: PaginateOptions<T>): PaginatedResult<T> {
  const { data, query, filter, sort } = options;
  const { page = 1, limit = 20 } = query;

  const filtered = filter ? data.filter(filter) : [...data];

  if (sort) {
    filtered.sort(sort);
  }

  const startIndex = (page - 1) * limit;
  const paginatedData = filtered.slice(startIndex, startIndex + limit);

  return new PaginatedResult(paginatedData, filtered.length, page, limit);
}
