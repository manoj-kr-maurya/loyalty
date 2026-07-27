// src/common/utils/pagination.utils.ts

/**
 * Calculate pagination metadata based on total items and current page settings
 * @param totalItems Total number of items across all pages
 * @param page Current page number (1-based)
 * @param limit Number of items per page
 * @returns Pagination metadata object
 */
export function getPaginationMetadata(
  totalItems: number,
  page: number,
  limit: number,
) {
  const totalPages = Math.ceil(totalItems / limit);
  const currentPage = Math.min(page, totalPages);
  const itemsPerPage = limit;

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    // Optional: include these if you want to show page ranges
    startItem: (currentPage - 1) * limit + 1,
    endItem: Math.min(currentPage * limit, totalItems),
  };
}

/**
 * Calculate skip value for database queries
 * @param page Current page number (1-based)
 * @param limit Items per page
 * @returns Number of items to skip
 */
export function calculateSkip(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * limit;
}

/**
 * Normalize pagination parameters
 * @param page Requested page number
 * @param limit Requested items per page
 * @param maxLimit Maximum allowed items per page
 * @returns Normalized pagination parameters
 */
export function normalizePaginationParams(
  page = 1,
  limit = 10,
  maxLimit = 100,
) {
  return {
    page: Math.max(1, page),
    limit: Math.min(Math.max(1, limit), maxLimit),
  };
}

// Type definitions for pagination
export interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startItem: number;
  endItem: number;
}

export interface PaginatedResult<T> {
  data: T[];
  metadata: PaginationMetadata;
}

// Helper to create paginated response
export function createPaginatedResponse<T>(
  data: T[],
  metadata: PaginationMetadata,
): PaginatedResult<T> {
  return {
    data,
    metadata,
  };
}

// Example usage in your service:
/*
async function getPaginatedData(page: number, limit: number) {
  const normalizedParams = normalizePaginationParams(page, limit);
  const skip = calculateSkip(normalizedParams.page, normalizedParams.limit);
  
  const [data, totalItems] = await Promise.all([
    prisma.yourModel.findMany({
      skip,
      take: normalizedParams.limit,
    }),
    prisma.yourModel.count(),
  ]);

  const metadata = getPaginationMetadata(
    totalItems,
    normalizedParams.page,
    normalizedParams.limit
  );

  return createPaginatedResponse(data, metadata);
}
*/
