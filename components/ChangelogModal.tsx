import React from 'react';
import { X, Star, Bug, Zap } from 'lucide-react';
import { Release } from '../changelog';

interface ChangelogModalProps {
  release: Release;
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ release, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border flex justify-between items-center bg-surfaceHighlight/50">
          <div>
            <h2 className="text-2xl font-bold text-textMain flex items-center gap-3">
              What's New
              <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-1 rounded-full border border-primary/30">
                v{release.version}
              </span>
            </h2>
            <p className="text-textMuted text-sm mt-1">Released on {release.date}</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-textMain transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          {release.features.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-textMain mb-3 flex items-center gap-2">
                <Star className="text-secondary" size={20} /> New Features
              </h3>
              <ul className="space-y-2">
                {release.features.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-textMuted text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {release.improvements && release.improvements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-textMain mb-3 flex items-center gap-2">
                <Zap className="text-amber-400" size={20} /> Improvements
              </h3>
              <ul className="space-y-2">
                {release.improvements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-textMuted text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {release.bugFixes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-textMain mb-3 flex items-center gap-2">
                <Bug className="text-danger" size={20} /> Bug Fixes
              </h3>
              <ul className="space-y-2">
                {release.bugFixes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-textMuted text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surfaceHighlight/30 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-primary hover:bg-primary/80 text-white px-6 py-2 rounded-xl font-medium transition-all shadow-lg shadow-primary/20"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
