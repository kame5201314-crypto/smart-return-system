import { Skeleton } from '@/components/ui/skeleton';

export default function ReturnsListLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-40" />
        <Skeleton className="h-10 w-full sm:w-40" />
        <Skeleton className="h-10 w-full sm:w-24" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="grid grid-cols-6 gap-4 border-b bg-gray-50 px-4 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-6 gap-4 border-b px-4 py-4 last:border-b-0"
          >
            {Array.from({ length: 6 }).map((_, col) => (
              <Skeleton key={col} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
