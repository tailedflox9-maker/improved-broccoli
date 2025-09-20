import { APISettings } from '../types';

const SETTINGS_KEY = 'ai-tutor-settings';

const defaultSettings: APISettings = {
  selectedModel: 'google',
};

export const storageUtils = {
  // --- Settings ---
  getSettings(): APISettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) return defaultSettings;
      const parsed = JSON.parse(stored);
      // Ensure all keys from defaultSettings are present
      return { ...defaultSettings, ...parsed };
    } catch (error) {
      console.error('Error loading settings:', error);
      return defaultSettings;
    }
  },

  saveSettings(settings: APISettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  },

  // --- Clear All Data (Note: only clears settings now) ---
  clearAllData(): void {
    try {
      localStorage.removeItem(SETTINGS_KEY);
      // To clear everything including auth token for a full reset:
      // localStorage.clear();
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  },
};
