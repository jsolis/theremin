import { SoundPreset, WaveformType } from './types';

export const DEFAULT_PRESET: SoundPreset = {
  name: "Classic Theremin",
  waveform: WaveformType.SINE,
  vibratoDepth: 10,
  vibratoSpeed: 6,
  delayTime: 0.25,
  feedback: 0.3,
  distortion: 0,
  reverbMix: 0.35
};

export const MIN_FREQ = 130.81; // C3
export const MAX_FREQ = 1046.50; // C6

// Helper to calculate key frequencies and layout
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];