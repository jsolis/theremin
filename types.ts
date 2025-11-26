
export enum WaveformType {
  SINE = 'sine',
  SQUARE = 'square',
  SAWTOOTH = 'sawtooth',
  TRIANGLE = 'triangle'
}

export interface SoundPreset {
  id?: string; // Optional ID for cloud presets
  name: string;
  waveform: WaveformType;
  vibratoDepth: number; // 0 to 50
  vibratoSpeed: number; // 0 to 20 Hz
  delayTime: number; // 0 to 1 sec
  feedback: number; // 0 to 0.9
  distortion: number; // 0 to 50
  reverbMix: number; // 0 to 1
}

export interface AudioState {
  isPlaying: boolean;
  frequency: number;
  volume: number;
}

// Used for the piano key generation
export interface PianoKeyData {
  note: string;
  type: 'white' | 'black';
  frequency: number;
  leftOffset: number; // Percentage for positioning
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
}
