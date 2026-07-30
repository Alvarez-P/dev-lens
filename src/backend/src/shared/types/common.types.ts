export interface PaginationMeta {
  total: number;

  page: number;

  limit: number;

  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export type SortOrder = 'asc' | 'desc';

export type Nullable<T> = T | null;
