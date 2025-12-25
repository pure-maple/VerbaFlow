
import React from 'react';
import { AppStep } from '../types';
import { Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  currentStep: AppStep;
  onStepClick?: (step: AppStep) => void;
}

const StepIndicator: React.FC<Props> = ({ currentStep, onStepClick }) => {
  const { t } = useLanguage();

  const steps = [
    { id: AppStep.UPLOAD, label: t.steps.upload },
    // { id: AppStep.ANALYSIS, label: t.steps.analysis }, // Removed
    { id: AppStep.CONFIRMATION, label: t.steps.confirm },
    { id: AppStep.GENERATION_SRT, label: t.steps.genSRT },
    { id: AppStep.GENERATION_MD, label: t.steps.genMD },
  ];

  return (
    <div className="w-full py-6 px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm shrink-0 z-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;

            return (
              <div key={step.id} className="flex flex-col items-center flex-1 relative">
                {/* Connecting Line */}
                {index !== 0 && (
                  <div className={`absolute top-4 left-[-50%] right-[50%] h-0.5 ${
                    step.id <= currentStep ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'
                  }`} />
                )}
                
                <button 
                  onClick={() => onStepClick && onStepClick(step.id)}
                  disabled={!onStepClick}
                  className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors duration-300 ${
                    isCompleted || isCurrent 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  } ${onStepClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                >
                  {isCompleted ? <Check size={16} /> : <span className="text-sm font-semibold">{step.id}</span>}
                </button>
                <span className={`mt-2 text-xs font-medium uppercase tracking-wider ${
                  isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StepIndicator;
