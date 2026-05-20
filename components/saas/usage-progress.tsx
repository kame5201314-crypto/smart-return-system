import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UsageProgressProps {
  value: number;
  className?: string;
  'aria-label'?: string;
}

export function UsageProgress({ value, className, ...rest }: UsageProgressProps) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const tone =
    safe >= 100
      ? 'bg-red-100 [&_[data-slot=progress-indicator]]:bg-red-500'
      : safe >= 80
      ? 'bg-amber-100 [&_[data-slot=progress-indicator]]:bg-amber-500'
      : 'bg-emerald-100 [&_[data-slot=progress-indicator]]:bg-emerald-500';

  return <Progress value={safe} className={cn(tone, className)} {...rest} />;
}
