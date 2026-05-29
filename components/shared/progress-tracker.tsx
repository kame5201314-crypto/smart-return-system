'use client';

import { Check, AlertTriangle } from 'lucide-react';
import { RETURN_STATUS } from '@/config/constants';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface ProgressStepTimes {
  pendingInspection?: string | null;
  completed?: string | null;
  abnormal?: string | null;
}

interface ProgressTrackerProps {
  currentStatus: string;
  className?: string;
  stepTimes?: ProgressStepTimes;
}

// Simplified 3-step progress: 待審核 → 已結案, with 驗收異常 as separate state
const SIMPLIFIED_STEPS = [
  { key: 'pending_inspection', label: '待審核' },
  { key: 'completed', label: '已結案' },
  { key: 'abnormal', label: '驗收異常' },
];

function formatStepTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'yyyy/MM/dd HH:mm', { locale: zhTW });
}

export function ProgressTracker({ currentStatus, className = '', stepTimes }: ProgressTrackerProps) {
  const isAbnormal = currentStatus === RETURN_STATUS.ABNORMAL_DISPUTED;
  const isCompleted = currentStatus === RETURN_STATUS.COMPLETED;

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
            // For normal flow (待審核 → 已結案)
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
            const rawStepTime =
              index === 0
                ? stepTimes?.pendingInspection
                : index === 1
                  ? stepTimes?.completed
                  : stepTimes?.abnormal;
            const stepTime = formatStepTime(rawStepTime);

            return (
              <div
                key={step.key}
                className="flex flex-col items-center"
                style={{ width: '33.33%' }}
              >
                {stepTime && (
                  <p className="mb-2 text-[11px] leading-none text-muted-foreground">
                    {stepTime}
                  </p>
                )}

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
