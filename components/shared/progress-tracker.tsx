'use client';

import { Check } from 'lucide-react';
import { RETURN_STATUS_ORDER, RETURN_STATUS_LABELS, RETURN_STATUS } from '@/config/constants';

interface ProgressTrackerProps {
  currentStatus: string;
  className?: string;
}

export function ProgressTracker({ currentStatus, className = '' }: ProgressTrackerProps) {
  // RETURN_STATUS_ORDER already excludes abnormal status
  const steps = RETURN_STATUS_ORDER;

  const currentIndex = steps.indexOf(currentStatus as typeof steps[number]);
  const isAbnormal = currentStatus === RETURN_STATUS.ABNORMAL_DISPUTED;

  return (
    <div className={`${className}`}>
      {/* Abnormal alert */}
      {isAbnormal && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">
            您的退貨申請需要進一步審核，我們將盡快與您聯繫。
          </p>
        </div>
      )}

      {/* Progress steps */}
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
          style={{
            width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%`,
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((status, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <div
                key={status}
                className="flex flex-col items-center"
                style={{ width: `${100 / steps.length}%` }}
              >
                {/* Circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-300 z-10
                    ${isCompleted ? 'bg-primary text-white' : ''}
                    ${isCurrent ? 'bg-primary text-white ring-4 ring-primary/20' : ''}
                    ${isPending ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Label */}
                <p
                  className={`
                    mt-2 text-xs text-center max-w-[80px]
                    ${isCurrent ? 'font-medium text-primary' : 'text-muted-foreground'}
                  `}
                >
                  {RETURN_STATUS_LABELS[status]}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
