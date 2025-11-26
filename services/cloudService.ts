
import { SoundPreset, UserProfile } from '../types';

// Simulated Cloud Storage Service
// In a real app, this would make HTTP requests to your backend (e.g. POST /api/presets)

const MOCK_DELAY = 600;

export const cloudService = {
  getPresets: async (userId: string): Promise<SoundPreset[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate fetching from a database by using a separate localStorage key
        // acting as a "cloud" bucket
        const stored = localStorage.getItem(`lumina_cloud_${userId}`);
        const presets = stored ? JSON.parse(stored) : [];
        resolve(presets);
      }, MOCK_DELAY);
    });
  },

  savePreset: async (userId: string, preset: SoundPreset): Promise<SoundPreset> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const key = `lumina_cloud_${userId}`;
        const stored = localStorage.getItem(key);
        const presets: SoundPreset[] = stored ? JSON.parse(stored) : [];
        
        let savedPreset: SoundPreset;
        
        // Update or Add
        const existingIndex = presets.findIndex(p => p.name === preset.name);
        
        if (existingIndex >= 0) {
            // Update existing: preserve ID if the incoming preset doesn't have one or has a different one
            // We trust the ID in the DB for the name.
            savedPreset = { 
                ...preset, 
                id: presets[existingIndex].id 
            };
            presets[existingIndex] = savedPreset;
        } else {
            // New entry
            savedPreset = { 
                ...preset, 
                id: preset.id || `cloud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
            };
            presets.push(savedPreset);
        }
        
        localStorage.setItem(key, JSON.stringify(presets));
        resolve(savedPreset);
      }, MOCK_DELAY);
    });
  },

  deletePreset: async (userId: string, presetName: string): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const stored = localStorage.getItem(`lumina_cloud_${userId}`);
            if (stored) {
                let presets: SoundPreset[] = JSON.parse(stored);
                presets = presets.filter(p => p.name !== presetName);
                localStorage.setItem(`lumina_cloud_${userId}`, JSON.stringify(presets));
            }
            resolve();
        }, MOCK_DELAY);
    });
  }
};
