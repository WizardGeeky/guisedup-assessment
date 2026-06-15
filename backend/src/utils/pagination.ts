export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function parseCursorPagination(
  cursor?: string,
  limit = 20,
): CursorPaginationParams {
  return {
    cursor: cursor ?? undefined,
    limit: Math.min(Math.max(1, limit), 100),
  };
}

// For legacy page-based pagination (search results)
export interface PagePaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

export function parsePagePagination(
  page = 1,
  pageSize = 20,
): PagePaginationParams {
  const normalizedPage = Math.max(1, page);
  const normalizedSize = Math.min(Math.max(1, pageSize), 100);
  return {
    page: normalizedPage,
    pageSize: normalizedSize,
    skip: (normalizedPage - 1) * normalizedSize,
  };
}
