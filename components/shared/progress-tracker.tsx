'use client';

import { Check, AlertTriangle } from 'lucide-react';
import { RETURN_STATUS } from '@/config/constants';

interface ProgressTrackerProps {
  currentStatus: string;
  className?: string;
}

// Simplified 3-step progress: 待驗收 → 已結案, with 驗收異常 as separate state
const SIMPLIFIED_STEPS = [
  { key: 'pending_inspection', label: '待驗收' },
  { key: 'completed', label: '已結案' },
  { key: 'abnormal', label: '驗收異常' },
];

export function ProgressTracker({ currentStatus, className = '' }: ProgressTrackerProps) {
  const isAbnormal = currentStatus === RETURN_STATUS.ABNORMAL_DISPUTED;
  const isCompleted = currentStatus === RETURN_STATUS.COMPLETED;

  // Determine current step index (0: 待驗收, 1: 已結案, 2: 驗收異常)
  let currentIndex = 0;
  if (isCompleted) currentIndex = 1;
  if (isAbnormal) currentIndex = 2;

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
        {!isAbnormal && (
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500"
            style={{
              width: isCompleted ? '50%' : '0%',
            }}
          />
        )}

        {/* Steps */}
        <div className="relative flex justify-between">
          {SIMPLIFIED_STEPS.map((step, index) => {
            // For normal flow (待驗收 → 已結案)
            let isStepCompleted = false;
            let isStepCurrent = false;
            let isStepPending = true;

            if (isAbnormal) {
              // If abnormal, only step 3 is current
              isStepCurrent = index === 2;
              isStepPending = index !== 2;
            } else if (isCompleted) {
              // If completed, step 1 is done, step 2 is current
              isStepCompleted = index === 0;
              isStepCurrent = index === 1;
              isStepPending = index === 2;
            } else {
              // If pending inspection, step 1 is current
              isStepCurrent = index === 0;
              isStepPending = index > 0;
            }

            const isAbnormalStep = index === 2;

            return (
              <div
                key={step.key}
                className="flex flex-col items-center"
                style={{ width: '33.33%' }}
              >
                {/* Circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-300 z-10
                    ${isStepCompleted ? 'bg-primary text-white' : ''}
                    ${isStepCurrent && !isAbnormalStep ? 'bg-primary text-white ring-4 ring-primary/20' : ''}
                    ${isStepCurrent && isAbnormalStep ? 'bg-red-500 text-white ring-4 ring-red-200' : ''}
                    ${isStepPending ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {isStepCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isAbnormalStep && isStepCurrent ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Label */}
                <p
                  className={`
                    mt-2 text-xs text-center max-w-[80px]
                    ${isStepCurrent && !isAbnormalStep ? 'font-medium text-primary' : ''}
                    ${isStepCurrent && isAbnormalStep ? 'font-medium text-red-600' : ''}
                    ${!isStepCurrent ? 'text-muted-foreground' : ''}
                  `}
                >
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
