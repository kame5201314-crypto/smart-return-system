import { Skeleton } from '@/components/ui/skeleton';

export default function InternalLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-5">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-6">
        <Skeleton className="mb-2 h-5 w-32" />
        <Skeleton className="mb-4 h-4 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="size-8 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
