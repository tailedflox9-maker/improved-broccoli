import { APISettings, Conversation } from '../types';

const SETTINGS_KEY = 'ai-tutor-settings';

const defaultSettings: APISettings = {
  selectedModel: 'google',
};

// FIX: Create user-specific storage keys
const getUserSpecificKey = (baseKey: string, userId: string): string => {
  return `${baseKey}-${userId}`;
};

export const storageUtils = {
  // --- Settings (can remain global) ---
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

  // --- User-Specific Conversations ---
  getConversations(userId: string): Conversation[] {
    if (!userId) {
      console.warn('No userId provided for getting conversations');
      return [];
    }
    
    try {
      const userKey = getUserSpecificKey('ai-tutor-conversations', userId);
      const stored = localStorage.getItem(userKey);
      if (!stored) return [];
      
      // Revive date objects from strings
      return JSON.parse(stored, (key, value) => {
        if (key === 'created_at' || key === 'updated_at') {
          return new Date(value);
        }
        return value;
      });
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  },

  saveConversations(conversations: Conversation[], userId: string): void {
    if (!userId) {
      console.warn('No userId provided for saving conversations');
      return;
    }
    
    try {
      const userKey = getUserSpecificKey('ai-tutor-conversations', userId);
      localStorage.setItem(userKey, JSON.stringify(conversations));
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  },

  // --- Clear User-Specific Data ---
  clearUserData(userId: string): void {
    if (!userId) return;
    
    try {
      const userConversationsKey = getUserSpecificKey('ai-tutor-conversations', userId);
      localStorage.removeItem(userConversationsKey);
    } catch (error) {
      console.error('Error clearing user data:', error);
    }
  },

  // --- Clear All Data ---
  clearAllData(): void {
    try {
      localStorage.removeItem(SETTINGS_KEY);
      // Note: This won't clear user-specific data, which is intentional
      // Use clearUserData() for specific user cleanup
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  },

  // --- Migration Helper (for existing users) ---
  migrateExistingData(userId: string): void {
    try {
      const oldConversationsKey = 'ai-tutor-conversations';
      const oldData = localStorage.getItem(oldConversationsKey);
      
      if (oldData && userId) {
        const newKey = getUserSpecificKey('ai-tutor-conversations', userId);
        
        // Only migrate if new key doesn't exist
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, oldData);
          console.log('Migrated existing conversations to user-specific storage');
        }
        
        // Remove old data after migration
        localStorage.removeItem(oldConversationsKey);
      }
    } catch (error) {
      console.error('Error migrating existing data:', error);
    }
  }
};
