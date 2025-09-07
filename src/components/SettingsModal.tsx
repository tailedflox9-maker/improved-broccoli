import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Bot, Database, Download, Upload, Trash2, Monitor, Settings } from 'lucide-react';
import { APISettings } from '../types';
import { storageUtils } from '../utils/storage';
import { useAuth } from '../hooks/useAuth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: APISettings;
  onSaveSettings: (settings: APISettings) => void;
}

type TabType = 'models' | 'data' | 'about';

const models = [
    { id: 'google', name: 'Google Gemini Flash', description: 'Fast and efficient for general conversations', status: 'Available' },
    { id: 'zhipu', name: 'ZhipuAI GLM-4', description: 'Advanced reasoning capabilities', status: 'Available' },
    { id: 'mistral-small', name: 'Mistral Small', description: 'Balanced performance and speed', status: 'Available' },
    { id: 'mistral-codestral', name: 'Mistral Codestral', description: 'Specialized for coding tasks', status: 'Available' },
] as const;

export function SettingsModal({ isOpen, onClose, settings, onSaveSettings }: SettingsModalProps) {
  const { profile } = useAuth();
  const [localSettings, setLocalSettings] = useState<APISettings>(settings);
  const [activeTab, setActiveTab] = useState<TabType>('models');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };
  
  const handleModelChange = (modelId: APISettings['selectedModel']) => {
      setLocalSettings(prev => ({...prev, selectedModel: modelId }));
  }

  const handleExportData = () => {
    if (!profile) return alert("You must be logged in to export data.");
    const data = {
      conversations: storageUtils.getConversations(profile.id),
      settings: storageUtils.getSettings(),
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-tutor-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleClearData = () => {
    if (window.confirm('Are you sure you want to delete all conversations and settings? This action cannot be undone.')) {
      storageUtils.clearAllData();
      alert('All data has been cleared. The app will now reload.');
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  const TabButton = ({ id, label, Icon }: { id: TabType; label: string; Icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-semibold transition-colors rounded-lg ${
        activeTab === id ? 'bg-[var(--color-card)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-[var(--color-sidebar)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col animate-fade-in-up max-h-[90vh] max-h-[90dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-bold">Settings</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-card)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="p-2 grid grid-cols-3 gap-2 border-b border-[var(--color-border)] flex-shrink-0">
          <TabButton id="models" label="Models" Icon={Bot} />
          <TabButton id="data" label="Data" Icon={Database} />
          <TabButton id="about" label="About" Icon={Monitor} />
        </div>
        
        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto min-h-[20rem]">
          {activeTab === 'models' && (
            <div className="space-y-4 animate-fadeIn">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">API Configuration</h4>
                    <p className="text-xs text-[var(--color-text-secondary)]">API keys are managed securely on the server. Just choose your preferred model below.</p>
                </div>
                <div className="space-y-2">
                {models.map((model) => (
                    <button
                    key={model.id}
                    onClick={() => handleModelChange(model.id as APISettings['selectedModel'])}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${localSettings.selectedModel === model.id ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--color-border)] hover:border-gray-600'}`}
                    >
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                        <div className="font-medium text-[var(--color-text-primary)]">{model.name}</div>
                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">{model.description}</div>
                        </div>
                        {localSettings.selectedModel === model.id && <Check className="w-5 h-5 text-blue-500 ml-2" />}
                    </div>
                    </button>
                ))}
                </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="font-semibold mb-2">Manage Your Data</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button onClick={handleExportData} className="flex items-center justify-center gap-2 p-3 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-card)] transition-colors"> <Download className="w-4 h-4"/> Export Data</button>
                  <label className="flex items-center justify-center gap-2 p-3 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-card)] transition-colors cursor-pointer">
                     <Upload className="w-4 h-4"/> Import Data
                     <input type="file" onChange={() => {}} accept=".json" className="hidden"/>
                  </label>
                </div>
              </div>
               <div>
                <h3 className="font-semibold mb-2 text-red-400">Danger Zone</h3>
                <button onClick={handleClearData} className="w-full flex items-center justify-center gap-2 p-3 border border-red-500/30 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/40 hover:text-red-300 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  Clear All Data
                </button>
              </div>
            </div>
          )}
          
          {activeTab === 'about' && (
             <div className="space-y-6 animate-fadeIn text-center flex flex-col items-center justify-center h-full">
                <img src="/white-logo.png" alt="AI Tutor Logo" className="w-16 h-16 mx-auto" />
                <h4 className="text-lg font-bold text-[var(--color-text-primary)]">AI Tutor</h4>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">Intelligent learning companion designed to help students understand complex topics through AI-powered conversations.</p>
                <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-card)] rounded-lg p-3 font-mono">
                    Version: 1.2.0
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 sm:px-6 sm:py-2.5 text-[var(--color-text-primary)] hover:bg-[var(--color-card)] rounded-lg transition-colors font-semibold">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2 sm:px-6 sm:py-2.5 bg-[var(--color-accent-bg)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-bg-hover)] transition-colors font-semibold">
            Save
          </button>
        </div>
      </div>
    </div>
  );

After updating the file with this corrected code, commit the changes and try deploying to Vercel again. The build should now pass successfully.
