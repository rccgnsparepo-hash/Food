import React from 'react';
import { getPasswordStrength } from '../../lib/authErrorTranslator';

interface PasswordStrengthMeterProps {
  password?: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password = '' }) => {
  if (!password) return null;

  const { score, label } = getPasswordStrength(password);

  // Map label to display text & colors
  let displayLabel = label as string;
  if (displayLabel === 'Medium') displayLabel = 'Good';

  let labelTextColor = 'text-red-600';
  let bar1Color = 'bg-red-500';
  let bar2Color = 'bg-slate-200 dark:bg-slate-700';
  let bar3Color = 'bg-slate-200 dark:bg-slate-700';

  if (score === 2) {
    labelTextColor = 'text-amber-600 dark:text-amber-400';
    bar1Color = 'bg-amber-500';
    bar2Color = 'bg-amber-500';
    bar3Color = 'bg-slate-200 dark:bg-slate-700';
  } else if (score >= 3) {
    labelTextColor = 'text-emerald-600 dark:text-emerald-400';
    bar1Color = 'bg-emerald-500';
    bar2Color = 'bg-emerald-500';
    bar3Color = 'bg-emerald-500';
  }

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Password strength</span>
        <span className={`font-bold ${labelTextColor}`}>{displayLabel}</span>
      </div>
      <div className="flex gap-1 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
        <div className={`h-full flex-1 rounded-full transition-all duration-300 ${bar1Color}`} />
        <div className={`h-full flex-1 rounded-full transition-all duration-300 ${bar2Color}`} />
        <div className={`h-full flex-1 rounded-full transition-all duration-300 ${bar3Color}`} />
      </div>
    </div>
  );
};
