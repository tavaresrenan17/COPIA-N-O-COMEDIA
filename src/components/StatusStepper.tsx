'use client';

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusOrcamento } from '@/data/types';

interface StatusStepperProps {
  currentStatus: StatusOrcamento;
  onStatusChange?: (newStatus: StatusOrcamento) => void;
}

const STEPS: { key: StatusOrcamento; label: string }[] = [
  { key: 'FATURADO', label: 'Faturado' },
  { key: 'EXPEDIDO', label: 'Expedido' },
  { key: 'ENTREGUE', label: 'Entregue' },
  { key: 'RECEBIDO', label: 'Recebido' },
];

export function StatusStepper({ currentStatus, onStatusChange }: StatusStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStatus);

  const getStepState = (index: number) => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'pending';
  };

  const progressPercentage = (currentIndex / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full py-4 px-6 bg-transparent select-none">
      <div className="relative flex items-center justify-between">
        {/* Background track */}
        <div className="absolute top-3.5 left-6 right-6 h-1 bg-gray-200 -translate-y-1/2 z-0 rounded-full"></div>

        {/* Animated fill track */}
        <motion.div
          className="absolute top-3.5 left-6 h-1 bg-brand -translate-y-1/2 z-0 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `calc(${progressPercentage}% - 0.5rem)` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />

        {/* Step dots */}
        {STEPS.map((step, idx) => {
          const state = getStepState(idx);
          const isDoneOrActive = idx <= currentIndex;

          return (
            <div
              key={step.key}
              onClick={() => onStatusChange && onStatusChange(step.key)}
              className="relative z-10 flex flex-col items-center group cursor-pointer"
            >
              <motion.div
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isDoneOrActive
                    ? 'bg-brand text-white shadow-md shadow-brand/30 ring-4 ring-white'
                    : 'bg-white border-2 border-gray-300 text-transparent hover:border-brand/60'
                }`}
              >
                {isDoneOrActive ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                )}
              </motion.div>

              <span
                className={`mt-2 text-xs font-semibold transition-colors ${
                  isDoneOrActive ? 'text-ink-primary font-bold' : 'text-ink-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
