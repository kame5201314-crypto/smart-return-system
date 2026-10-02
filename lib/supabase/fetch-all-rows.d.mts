export declare function fetchAllRows<T, E>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>
): Promise<{ data: T[] | null; error: E | null }>;
