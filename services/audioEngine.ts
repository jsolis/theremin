import { SoundPreset, WaveformType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private mainOsc: OscillatorNode | null = null;
  private vibOsc: OscillatorNode | null = null;
  private vibGain: GainNode | null = null;
  
  // Chain nodes
  private filterNode: BiquadFilterNode | null = null;
  private waveShaper: WaveShaperNode | null = null;
  private masterGain: GainNode | null = null;
  
  // Effects
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  
  // Output
  public analyser: AnalyserNode | null = null;

  private currentPreset: SoundPreset;

  // Metronome State
  private metronomeIsPlaying: boolean = false;
  private metronomeBpm: number = 120;
  private metronomeSignature: number = 4;
  private metronomeNextNoteTime: number = 0;
  private metronomeBeatNumber: number = 0;
  private metronomeTimerID: number | null = null;
  private scheduleAheadTime: number = 0.1;
  private lookahead: number = 25.0;

  // UI Callback
  public onMetronomeBeat: ((beat: number) => void) | null = null;

  constructor() {
    this.currentPreset = {
        name: 'Default',
        waveform: WaveformType.SINE,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        delayTime: 0,
        feedback: 0,
        distortion: 0,
        reverbMix: 0
    };
  }

  public initialize() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    // Smooth the visualizer slightly
    this.analyser.smoothingTimeConstant = 0.85;

    // --- Main Voice Chain ---
    // Osc -> Filter -> WaveShaper -> MasterGain
    
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 5000; // Warm up the sound, remove digital harshness
    this.filterNode.Q.value = 1;

    this.waveShaper = this.ctx.createWaveShaper();
    this.waveShaper.curve = this.makeDistortionCurve(0);
    this.waveShaper.oversample = '4x';

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;

    // Connect Voice Chain basics
    this.filterNode.connect(this.waveShaper);
    this.waveShaper.connect(this.masterGain);

    // --- Effects Routing ---
    // MasterGain splits to:
    // 1. Analyser (Dry+Wet mix) via effects
    // To simplify, we sum everything into the analyser, then analyser to destination.
    
    // However, to control Dry/Wet levels properly:
    // MasterGain -> Dry (Direct to Analyser)
    // MasterGain -> Delay -> Analyser
    // MasterGain -> Reverb -> Analyser
    
    this.masterGain.connect(this.analyser);

    // --- Delay Setup ---
    this.delayNode = this.ctx.createDelay();
    this.feedbackGain = this.ctx.createGain();
    
    this.masterGain.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.analyser); 

    // --- Reverb Setup ---
    this.reverbNode = this.ctx.createConvolver();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0; // Default off

    // Generate a synthetic impulse response for the reverb
    this.reverbNode.buffer = this.createReverbImpulse(2.5, 2.0); // 2.5s duration, decay factor

    this.masterGain.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.analyser);

    // Final Output
    this.analyser.connect(this.ctx.destination);
  }

  public setPreset(preset: SoundPreset) {
    this.currentPreset = preset;
    if (!this.ctx) return;
    
    const t = this.ctx.currentTime;

    // Update Vibrato if active
    if (this.vibOsc && this.vibGain) {
      this.vibOsc.frequency.setTargetAtTime(preset.vibratoSpeed, t, 0.1);
      this.vibGain.gain.setTargetAtTime(preset.vibratoDepth, t, 0.1);
    }
    
    // Update Osc Type
    if (this.mainOsc) {
      this.mainOsc.type = preset.waveform;
    }

    // Update Delay
    if (this.delayNode && this.feedbackGain) {
      this.delayNode.delayTime.setTargetAtTime(preset.delayTime, t, 0.1);
      this.feedbackGain.gain.setTargetAtTime(preset.feedback, t, 0.1);
    }

    // Update Reverb
    if (this.reverbGain) {
        this.reverbGain.gain.setTargetAtTime(preset.reverbMix, t, 0.1);
    }

    // Update Distortion
    if (this.waveShaper) {
        this.waveShaper.curve = this.makeDistortionCurve(preset.distortion);
    }
  }

  public startNote(frequency: number, volume: number = 1.0) {
    if (!this.ctx) this.initialize();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }

    // Kill old note if exists (monophonic)
    this.stopNote();

    const t = this.ctx!.currentTime;

    // Update effects parameters immediately for attack
    if (this.feedbackGain) {
        this.feedbackGain.gain.cancelScheduledValues(t);
        this.feedbackGain.gain.value = this.currentPreset.feedback;
    }
    if (this.reverbGain) {
        this.reverbGain.gain.cancelScheduledValues(t);
        this.reverbGain.gain.value = this.currentPreset.reverbMix;
    }

    // Create Oscillators
    this.mainOsc = this.ctx!.createOscillator();
    this.mainOsc.type = this.currentPreset.waveform;
    this.mainOsc.frequency.setValueAtTime(frequency, t);

    // Vibrato LFO
    this.vibOsc = this.ctx!.createOscillator();
    this.vibOsc.frequency.setValueAtTime(this.currentPreset.vibratoSpeed, t);
    this.vibGain = this.ctx!.createGain();
    this.vibGain.gain.setValueAtTime(this.currentPreset.vibratoDepth, t);
    
    this.vibOsc.connect(this.vibGain);
    this.vibGain.connect(this.mainOsc.frequency);
    this.vibOsc.start(t);

    // Connect Oscillator to Filter (Start of chain)
    this.mainOsc.connect(this.filterNode!);

    this.mainOsc.start(t);
    
    // Envelope Attack
    this.masterGain!.gain.cancelScheduledValues(t);
    // Quick linear ramp to avoid clicking
    this.masterGain!.gain.linearRampToValueAtTime(volume * 0.4, t + 0.05); 
  }

  public updateNote(frequency: number, volume: number) {
    if (this.mainOsc && this.ctx) {
      const t = this.ctx.currentTime;
      // Smooth transition for glissando (Portamento)
      this.mainOsc.frequency.setTargetAtTime(frequency, t, 0.04); // Slightly increased lag for "Theremin" feel
      this.masterGain!.gain.setTargetAtTime(volume * 0.4, t, 0.04);
      
      // Key tracking for filter: slightly open filter for higher notes
      if (this.filterNode) {
        const filterFreq = Math.min(20000, frequency * 8); // Track harmonics
        this.filterNode.frequency.setTargetAtTime(filterFreq, t, 0.05);
      }
    }
  }

  public stopNote() {
    if (this.mainOsc && this.ctx) {
      const t = this.ctx.currentTime;
      
      // 1. Release envelope
      this.masterGain!.gain.cancelScheduledValues(t);
      this.masterGain!.gain.setValueAtTime(this.masterGain!.gain.value, t);
      this.masterGain!.gain.linearRampToValueAtTime(0, t + 0.15);
      
      // 2. Fade out feedback naturally
      if (this.feedbackGain) {
        this.feedbackGain.gain.cancelScheduledValues(t);
        this.feedbackGain.gain.setValueAtTime(this.feedbackGain.gain.value, t);
        this.feedbackGain.gain.linearRampToValueAtTime(0, t + 0.5);
      }

      const oldOsc = this.mainOsc;
      const oldVib = this.vibOsc;
      
      this.mainOsc = null;
      this.vibOsc = null;
      
      setTimeout(() => {
        try {
            oldOsc.stop();
            oldVib?.stop();
            oldOsc.disconnect();
            oldVib?.disconnect();
        } catch (e) {
            // Ignore
        }
      }, 200); 
    }
  }

  public getByteTimeDomainData(dataArray: Uint8Array) {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(dataArray);
    }
  }

  // --- Metronome Implementation ---

  public startMetronome(bpm: number, signature: '4/4' | '3/4') {
    if (this.metronomeIsPlaying) return;
    if (!this.ctx) this.initialize();
    if (this.ctx?.state === 'suspended') this.ctx.resume();

    this.metronomeIsPlaying = true;
    this.metronomeBpm = bpm;
    this.metronomeSignature = signature === '3/4' ? 3 : 4;
    this.metronomeBeatNumber = 0;
    this.metronomeNextNoteTime = this.ctx!.currentTime + 0.1;
    this.metronomeScheduler();
  }

  public stopMetronome() {
    this.metronomeIsPlaying = false;
    if (this.metronomeTimerID !== null) {
        window.clearTimeout(this.metronomeTimerID);
        this.metronomeTimerID = null;
    }
  }

  public setMetronome(bpm: number, signature: '4/4' | '3/4') {
    this.metronomeBpm = bpm;
    this.metronomeSignature = signature === '3/4' ? 3 : 4;
  }

  private metronomeScheduler() {
    if (!this.metronomeIsPlaying || !this.ctx) return;
    
    // While there are notes that will need to play before the next interval, schedule them
    while (this.metronomeNextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleMetronomeNote(this.metronomeBeatNumber, this.metronomeNextNoteTime);
        this.nextMetronomeNote();
    }
    
    this.metronomeTimerID = window.setTimeout(() => this.metronomeScheduler(), this.lookahead);
  }

  private nextMetronomeNote() {
    const secondsPerBeat = 60.0 / this.metronomeBpm;
    this.metronomeNextNoteTime += secondsPerBeat;
    this.metronomeBeatNumber++;
    if (this.metronomeBeatNumber >= this.metronomeSignature) {
        this.metronomeBeatNumber = 0;
    }
  }

  private scheduleMetronomeNote(beatNumber: number, time: number) {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.frequency.value = (beatNumber === 0) ? 1200 : 800;
    osc.type = 'square'; // Clickier sound for metronome

    // Short envelope
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start(time);
    osc.stop(time + 0.05);

    // Schedule UI Update to match audio time
    if (this.ctx) {
        const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
        window.setTimeout(() => {
            if (this.metronomeIsPlaying && this.onMetronomeBeat) {
                this.onMetronomeBeat(beatNumber);
            }
        }, delay);
    }
  }

  // Helper to generate a simple reverb impulse response
  private createReverbImpulse(duration: number, decay: number): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx!.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        // Simple noise with exponential decay
        const n = i; 
        const multiplier = Math.pow(1 - n / length, decay);
        left[i] = (Math.random() * 2 - 1) * multiplier;
        right[i] = (Math.random() * 2 - 1) * multiplier;
    }
    return impulse;
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 0,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180;
    let i = 0,
      x;
    if (amount === 0) return null;
    for (; i < n_samples; ++i) {
      x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

export const audioEngine = new AudioEngine();