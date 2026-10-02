// Callers must use a stable, unique order (usually an id tie-breaker).
// Never treat Supabase's default row limit as the complete dataset.
export async function fetchAllRows(fetchPage) {
  const rows = [];
  const pageSize = 500;
  for (;;) {
    const { data, error } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) return { data: null, error };
    if (!data) throw new Error('Missing data while reading a paginated query');
    if (data.length === 0) return { data: rows, error: null };
    rows.push(...data);
    // Continue even after a short page: the server may enforce a smaller cap.
  }
}
