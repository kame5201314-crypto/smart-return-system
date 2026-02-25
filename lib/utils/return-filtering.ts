export type ReturnSortField = 'status' | 'created_at' | 'channel_source' | null;
export type ReturnSortDirection = 'asc' | 'desc';

export interface ReturnListItem {
  request_number: string;
  status: string;
  created_at: string;
  channel_source: string | null;
  order?: {
    customer_name: string | null;
    customer_phone: string | null;
    order_number: string;
  } | null;
}

export function filterAndSortReturns<T extends ReturnListItem>(
  items: T[],
  options: {
    appliedSearchQuery: string;
    statusFilter: string;
    channelFilter: string;
    sortField: ReturnSortField;
    sortDirection: ReturnSortDirection;
    statusOrder: Record<string, number>;
  }
): T[] {
  const {
    appliedSearchQuery,
    statusFilter,
    channelFilter,
    sortField,
    sortDirection,
    statusOrder,
  } = options;

  let filtered = [...items];

  if (appliedSearchQuery) {
    const query = appliedSearchQuery.toLowerCase().replace(/[-\s]/g, '');
    filtered = filtered.filter(
      (r) =>
        r.request_number.toLowerCase().includes(query)
        || r.order?.customer_name?.toLowerCase().includes(query)
        || r.order?.order_number?.toLowerCase().includes(query)
        || r.order?.customer_phone?.replace(/[-\s]/g, '').includes(query)
    );
  }

  if (statusFilter !== 'all') {
    if (statusFilter === 'pending_inspection') {
      const pendingStatuses = [
        'pending_review',
        'approved_waiting_shipping',
        'shipping_in_transit',
        'received_inspecting',
        'refund_processing',
      ];
      filtered = filtered.filter((r) => pendingStatuses.includes(r.status));
    } else {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }
  }

  if (channelFilter !== 'all') {
    filtered = filtered.filter((r) => r.channel_source === channelFilter);
  }

  if (sortField) {
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'status': {
          const statusA = statusOrder[a.status] ?? 99;
          const statusB = statusOrder[b.status] ?? 99;
          comparison = statusA - statusB;
          break;
        }
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'channel_source': {
          const channelA = a.channel_source || '';
          const channelB = b.channel_source || '';
          comparison = channelA.localeCompare(channelB);
          break;
        }
        default:
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  return filtered;
}
