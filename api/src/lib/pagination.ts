export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MIN = 1;
export const PAGE_SIZE_MAX = 100;

export interface PaginationParams {
  cursor: string | null;
  limit: number;
}

export function parsePaginationParams(query: Record<string, string | undefined>): PaginationParams {
  const cursor = query.cursor ?? null;

  const rawLimit = query.limit ?? query.page_size;
  let limit = parseInt(rawLimit ?? String(PAGE_SIZE_DEFAULT), 10);
  if (isNaN(limit) || limit < PAGE_SIZE_MIN) limit = PAGE_SIZE_DEFAULT;
  if (limit > PAGE_SIZE_MAX) limit = PAGE_SIZE_MAX;

  return { cursor, limit };
}

export function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function buildPaginatedResponse<T>(
  data: T[],
  limit: number,
  cursorField: string,
  prevCursor: string | null = null,
  totalCount?: number,
) {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1] as Record<string, unknown>;
    nextCursor = encodeCursor({ [cursorField]: lastItem[cursorField] });
  }

  return {
    data: items,
    pagination: {
      next_cursor: nextCursor,
      prev_cursor: prevCursor,
      has_more: hasMore,
      page_size: limit,
      ...(totalCount !== undefined ? { total_count: totalCount } : {}),
    },
  };
}
