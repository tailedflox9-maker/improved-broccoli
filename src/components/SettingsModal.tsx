import React from 'react';
import { X, Check } from 'lucide-react';
import { APISettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: APISettings;
  onSaveSettings: (settings: APISettings) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const handleModelChange = (model: APISettings['selectedModel']) => {
    onSaveSettings({ ...settings, selectedModel: model });
  };

  const models = [
    { id: 'google', name: 'Google Gemini Flash', description: 'Fast and efficient for general conversations' },
    { id: 'zhipu', name: 'ZhipuAI GLM-4', description: 'Advanced reasoning capabilities' },
    { id: 'mistral-small', name: 'Mistral Small', description: 'Balanced performance and speed' },
    { id: 'mistral-codestral', name: 'Mistral Codestral', description: 'Specialized for coding tasks' },
  ] as const;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleOverlayClick}>
      <div className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-border)] rounded-lg transition-colors"
            title="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* API Configuration Info */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">API Configuration</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              API keys are configured on the server side for security. 
              Contact your administrator if you need access to additional models.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">AI Model</h3>
            <div className="space-y-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    settings.selectedModel === model.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-[var(--color-border)] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--color-text-primary)]">
                        {model.name}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {model.description}
                      </div>
                    </div>
                    {settings.selectedModel === model.id && (
                      <Check className="w-5 h-5 text-blue-500 ml-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* About Section */}
          <div className="pt-4 border-t border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">About</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              AI Tutor helps students learn through interactive conversations. 
              Choose the model that best fits your learning needs.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="w-full bg-[var(--color-accent-bg)] hover:bg-[var(--color-accent-bg-hover)] text-black font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
