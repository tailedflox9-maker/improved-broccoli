================================================
FILE: src/components/SettingsModal.tsx
================================================
import React, { useState, useCallback } from 'react';
import { X, Check, Bot, Palette, Shield, Trash2, Download, Upload, Moon, Sun, Monitor } from 'lucide-react';
import { APISettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: APISettings;
  onSaveSettings: (settings: APISettings) => void;
}

type TabType = 'models' | 'appearance' | 'privacy' | 'about';

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('models');
  const [theme, setTheme] = useState(() => localStorage.getItem('ai-tutor-theme') || 'dark');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('ai-tutor-font-size') || 'medium');

  // FIX: Moved useCallback hooks before the conditional return to respect the Rules of Hooks.
  const handleExportData = useCallback(() => {
    try {
      const data = {
        conversations: localStorage.getItem('ai-tutor-conversations') || '[]',
        settings: localStorage.getItem('ai-tutor-settings') || '{}',
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-tutor-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export data');
    }
  }, []);

  const handleImportData = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        if (importedData.conversations) {
          localStorage.setItem('ai-tutor-conversations', importedData.conversations);
        }
        if (importedData.settings) {
          localStorage.setItem('ai-tutor-settings', importedData.settings);
          const parsedSettings = JSON.parse(importedData.settings);
          onSaveSettings({ ...settings, ...parsedSettings });
        }
        
        alert('Data imported successfully! Please refresh the page.');
      } catch (error) {
        alert('Invalid backup file format');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [settings, onSaveSettings]);

  const handleClearAllData = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      localStorage.clear();
      sessionStorage.clear();
      alert('All data cleared. Please refresh the page.');
    }
  }, []);

  if (!isOpen) return null;

  const handleModelChange = (model: APISettings['selectedModel']) => {
    onSaveSettings({ ...settings, selectedModel: model });
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('ai-tutor-theme', newTheme);
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    localStorage.setItem('ai-tutor-font-size', size);
    document.documentElement.setAttribute('data-font-size', size);
  };

  const models = [
    { id: 'google', name: 'Google Gemini Flash', description: 'Fast and efficient for general conversations', status: 'Available' },
    { id: 'zhipu', name: 'ZhipuAI GLM-4', description: 'Advanced reasoning capabilities', status: 'Available' },
    { id: 'mistral-small', name: 'Mistral Small', description: 'Balanced performance and speed', status: 'Available' },
    { id: 'mistral-codestral', name: 'Mistral Codestral', description: 'Specialized for coding tasks', status: 'Available' },
  ] as const;

  const tabs = [
    { id: 'models', name: 'Models', icon: Bot },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'privacy', name: 'Privacy', icon: Shield },
    { id: 'about', name: 'About', icon: Monitor },
  ] as const;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderModelsTab = () => (
    <div className="space-y-4">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">API Configuration</h4>
        <p className="text-xs text-[var(--color-text-secondary)]">
          API keys are configured on the server side for security. 
          Contact your administrator if you need access to additional models.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Available Models</h4>
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {model.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                      {model.status}
                    </span>
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
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Theme</h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'light', name: 'Light', icon: Sun },
            { id: 'dark', name: 'Dark', icon: Moon },
            { id: 'system', name: 'System', icon: Monitor }
          ].map((themeOption) => {
            const IconComponent = themeOption.icon;
            return (
              <button
                key={themeOption.id}
                onClick={() => handleThemeChange(themeOption.id)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  theme === themeOption.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-[var(--color-border)] hover:border-gray-600'
                }`}
              >
                <IconComponent className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs font-medium">{themeOption.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Font Size</h4>
        <div className="space-y-2">
          {[
            { id: 'small', name: 'Small', description: 'Compact text size' },
            { id: 'medium', name: 'Medium', description: 'Default text size' },
            { id: 'large', name: 'Large', description: 'Larger text for better readability' }
          ].map((sizeOption) => (
            <button
              key={sizeOption.id}
              onClick={() => handleFontSizeChange(sizeOption.id)}
              className={`w-full p-3 rounded-lg border text-left transition-all ${
                fontSize === sizeOption.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-[var(--color-border)] hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-[var(--color-text-primary)]">
                    {sizeOption.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    {sizeOption.description}
                  </div>
                </div>
                {fontSize === sizeOption.id && <Check className="w-4 h-4 text-blue-500" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Data Management</h4>
        <div className="space-y-3">
          <button
            onClick={handleExportData}
            className="w-full p-3 rounded-lg border border-[var(--color-border)] hover:border-gray-600 transition-all flex items-center gap-3"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <div className="text-left">
              <div className="font-medium text-[var(--color-text-primary)]">Export Data</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Download your conversations and settings</div>
            </div>
          </button>

          <label className="w-full p-3 rounded-lg border border-[var(--color-border)] hover:border-gray-600 transition-all flex items-center gap-3 cursor-pointer">
            <Upload className="w-4 h-4 text-green-400" />
            <div className="text-left">
              <div className="font-medium text-[var(--color-text-primary)]">Import Data</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Restore from a backup file</div>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>

          <button
            onClick={handleClearAllData}
            className="w-full p-3 rounded-lg border border-red-500/30 hover:border-red-500 transition-all flex items-center gap-3 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
            <div className="text-left">
              <div className="font-medium">Clear All Data</div>
              <div className="text-xs opacity-80">Remove all conversations and settings</div>
            </div>
          </button>
        </div>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <h4 className="text-sm font-semibold text-yellow-400 mb-2">Privacy Notice</h4>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Your conversations are stored locally in your browser. We recommend exporting your data regularly for backup purposes.
        </p>
      </div>
    </div>
  );

  const renderAboutTab = () => (
    <div className="space-y-6">
      <div className="text-center">
        <img
          src="/white-logo.png"
          alt="AI Tutor Logo"
          className="w-16 h-16 mx-auto mb-4"
        />
        <h4 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">AI Tutor</h4>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Intelligent learning companion for students
        </p>
        <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-card)] rounded-lg p-3">
          <div className="flex justify-between mb-1">
            <span>Version:</span>
            <span className="font-mono">1.2.0</span>
          </div>
          <div className="flex justify-between">
            <span>Build:</span>
            <span className="font-mono">{new Date().toISOString().split('T')[0]}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Features</h4>
        <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
            <span>Multiple AI models for different learning styles</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
            <span>Interactive quizzes and assessments</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
            <span>Conversation history and note-taking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
            <span>Privacy-focused local storage</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Support</h4>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          For technical support or feature requests, please contact your administrator. 
          This application is designed to help students learn more effectively through AI-powered conversations.
        </p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'models': return renderModelsTab();
      case 'appearance': return renderAppearanceTab();
      case 'privacy': return renderPrivacyTab();
      case 'about': return renderAboutTab();
      default: return renderModelsTab();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleOverlayClick}>
      <div className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
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

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-[var(--color-sidebar)] border-r border-[var(--color-border)] p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-card)]'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {renderTabContent()}
            </div>
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
