export interface PaginationParams {
  cursor: string | null;
  limit: number;
}

export function parsePaginationParams(query: Record<string, string | undefined>): PaginationParams {
  const cursor = query.cursor ?? null;
  let limit = parseInt(query.limit ?? '25', 10);
  if (isNaN(limit) || limit < 1) limit = 25;
  if (limit > 100) limit = 100;
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
      ...(totalCount !== undefined ? { total_count: totalCount } : {}),
    },
  };
}
