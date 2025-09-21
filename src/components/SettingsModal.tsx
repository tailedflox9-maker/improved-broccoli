import React, { useState } from 'react';
import { X, Monitor, Settings, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'account' | 'about';  // <-- Removed 'data'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('account');

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
        <div className="p-2 grid grid-cols-2 gap-2 border-b border-[var(--color-border)] flex-shrink-0">  {/* <-- Updated to grid-cols-2 */}
          <TabButton id="account" label="Account" Icon={User} />
          <TabButton id="about" label="About" Icon={Monitor} />
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto min-h-[20rem]">
          {activeTab === 'account' && profile && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="font-semibold mb-2 text-lg">Your Profile</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400">Full Name</label>
                  <p className="p-3 bg-[var(--color-card)] rounded-lg mt-1">{profile.full_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Email Address</label>
                  <p className="p-3 bg-[var(--color-card)] rounded-lg mt-1">{profile.email}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Role</label>
                  <p className="p-3 bg-[var(--color-card)] rounded-lg mt-1 capitalize">{profile.role}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-6 animate-fadeIn text-center flex flex-col items-center justify-center h-full">
              <img src="/white-logo.png" alt="AI Tutor Logo" className="w-16 h-16 mx-auto" />
              <h4 className="text-lg font-bold text-[var(--color-text-primary)]">AI Tutor</h4>
              <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
                Intelligent learning companion designed to help students understand complex topics through AI-powered conversations.
              </p>
              <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-card)] rounded-lg p-3 font-mono">
                Version: 1.2.0
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 sm:px-6 sm:py-2.5 bg-[var(--color-accent-bg)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-bg-hover)] transition-colors font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
