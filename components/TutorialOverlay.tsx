import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export interface TutorialStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ steps, isOpen, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = steps[currentStepIndex];

  const updateTargetRect = useCallback(() => {
    if (!currentStep) return;
    
    // Execute action if defined (e.g. switch tab)
    if (currentStep.action) {
        currentStep.action();
    }

    // Wait for DOM update
    setTimeout(() => {
        const element = document.getElementById(currentStep.targetId);
        if (element) {
          const rect = element.getBoundingClientRect();
          // Check if element is visible
          if (rect.width > 0 && rect.height > 0) {
              setTargetRect(rect);
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
              // Element exists but hidden, maybe wait or skip?
              console.warn(`Element ${currentStep.targetId} is hidden`);
          }
        } else {
          setTargetRect(null);
          console.warn(`Element ${currentStep.targetId} not found`);
        }
    }, 100); // Small delay for tab switching or rendering
  }, [currentStep]);

  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
      window.addEventListener('resize', updateTargetRect);
      window.addEventListener('scroll', updateTargetRect, true);
    }
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isOpen, currentStepIndex, updateTargetRect]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose();
      setCurrentStepIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  if (targetRect) {
    const padding = 15;
    const tooltipWidth = 320; 
    
    // Default to bottom if not specified
    const position = currentStep.position || 'bottom';

    switch (position) {
      case 'bottom':
        tooltipStyle = {
          top: targetRect.bottom + padding,
          left: targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2),
        };
        break;
      case 'top':
        tooltipStyle = {
          bottom: window.innerHeight - targetRect.top + padding,
          left: targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2),
        };
        break;
      case 'right':
        tooltipStyle = {
          top: targetRect.top + (targetRect.height / 2) - 100, 
          left: targetRect.right + padding,
        };
        break;
      case 'left':
        tooltipStyle = {
          top: targetRect.top + (targetRect.height / 2) - 100,
          right: window.innerWidth - targetRect.left + padding,
        };
        break;
    }
    
    // Simple boundary checks to keep it on screen
    if (tooltipStyle.left && (tooltipStyle.left as number) < 10) tooltipStyle.left = 10;
    const rightEdge = (tooltipStyle.left as number) + tooltipWidth;
    if (rightEdge > window.innerWidth) {
        tooltipStyle.left = window.innerWidth - tooltipWidth - 10;
    }

    // Vertical boundary check to prevent overflow
    const estimatedHeight = 300; // Estimate height including padding/buttons
    if (tooltipStyle.top && (tooltipStyle.top as number) + estimatedHeight > window.innerHeight) {
        // Shift up to fit in viewport with some padding
        tooltipStyle.top = Math.max(10, window.innerHeight - estimatedHeight - 20);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none font-sans">
      {/* Dark Overlay with cutout */}
      <div className="absolute inset-0 bg-black/60 transition-all duration-500 ease-in-out" style={{
        clipPath: targetRect ? 
          `polygon(
            0% 0%, 
            0% 100%, 
            100% 100%, 
            100% 0%, 
            ${targetRect.left}px 0%, 
            ${targetRect.left}px ${targetRect.top}px, 
            ${targetRect.right}px ${targetRect.top}px, 
            ${targetRect.right}px ${targetRect.bottom}px, 
            ${targetRect.left}px ${targetRect.bottom}px, 
            ${targetRect.left}px 0%
          )` : 'none'
      }}></div>

      {/* Highlight Box Border */}
      {targetRect && (
        <div 
          className="absolute border-2 border-indigo-400 rounded-lg shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all duration-500 ease-in-out"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      {/* Tooltip Card */}
      {targetRect && (
        <div 
          className="absolute pointer-events-auto bg-surface border border-slate-600 rounded-xl shadow-2xl p-6 w-80 flex flex-col animate-fade-in transition-all duration-500 ease-in-out"
          style={tooltipStyle}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="bg-indigo-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                {currentStepIndex + 1}
              </span>
              {currentStep.title}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
          
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            {currentStep.content}
          </p>

          <div className="flex justify-between items-center mt-auto">
            <button 
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition-colors ${currentStepIndex === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
            >
              Back
            </button>
            <div className="flex gap-1.5">
               {steps.map((_, idx) => (
                   <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentStepIndex ? 'bg-indigo-500' : 'bg-slate-700'}`} />
               ))}
            </div>
            <button 
              onClick={handleNext}
              className="flex items-center gap-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
            >
              {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
              {currentStepIndex < steps.length - 1 && <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
