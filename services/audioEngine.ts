import { SoundPreset, WaveformType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private mainOsc: OscillatorNode | null = null;
  private vibOsc: OscillatorNode | null = null;
  private vibGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private waveShaper: WaveShaperNode | null = null;
  public analyser: AnalyserNode | null = null;

  private currentPreset: SoundPreset;

  constructor() {
    this.currentPreset = {
        name: 'Default',
        waveform: WaveformType.SINE,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        delayTime: 0,
        feedback: 0,
        distortion: 0
    };
  }

  public initialize() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;

    // Delay Chain
    this.delayNode = this.ctx.createDelay();
    this.feedbackGain = this.ctx.createGain();
    
    // Distortion
    this.waveShaper = this.ctx.createWaveShaper();
    this.waveShaper.curve = this.makeDistortionCurve(0);
    this.waveShaper.oversample = '4x';

    // Routing: Osc -> WaveShaper -> MasterGain -> Analyser -> Destination
    //                                          -> Delay -> Feedback -> Delay
    //                                          -> Delay -> MasterGain (Wet Mix)

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    
    // Delay Loop
    this.masterGain.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.analyser); // Wet signal to output
  }

  public setPreset(preset: SoundPreset) {
    this.currentPreset = preset;
    if (this.vibOsc && this.vibGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.vibOsc.frequency.setValueAtTime(preset.vibratoSpeed, t);
      this.vibGain.gain.setValueAtTime(preset.vibratoDepth, t);
    }
    if (this.mainOsc) {
      this.mainOsc.type = preset.waveform;
    }
    if (this.delayNode && this.feedbackGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.delayNode.delayTime.setValueAtTime(preset.delayTime, t);
      
      // Only update feedback immediately if we are playing or if it's static setup.
      // If we are in the middle of a 'stop' fade out, this might jump, but acceptable for UI slider change.
      this.feedbackGain.gain.setValueAtTime(preset.feedback, t);
    }
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

    // Restore Feedback (in case it was faded out by stopNote)
    if (this.feedbackGain) {
        this.feedbackGain.gain.cancelScheduledValues(t);
        this.feedbackGain.gain.setValueAtTime(this.currentPreset.feedback, t);
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

    // Connections
    // MainOsc -> WaveShaper -> MasterGain
    this.mainOsc.connect(this.waveShaper!);
    this.waveShaper!.connect(this.masterGain!);

    this.mainOsc.start(t);
    
    // Smooth attack
    this.masterGain!.gain.cancelScheduledValues(t);
    // We do NOT set value to 0 here to avoid pops if re-triggering from a decaying note
    this.masterGain!.gain.linearRampToValueAtTime(volume * 0.5, t + 0.05); // 0.5 to avoid clipping
  }

  public updateNote(frequency: number, volume: number) {
    if (this.mainOsc && this.ctx) {
      const t = this.ctx.currentTime;
      // Smooth transition for glissando
      this.mainOsc.frequency.setTargetAtTime(frequency, t, 0.02); 
      this.masterGain!.gain.setTargetAtTime(volume * 0.5, t, 0.02);
    }
  }

  public stopNote() {
    if (this.mainOsc && this.ctx) {
      const t = this.ctx.currentTime;
      
      // 1. Release envelope for the source sound
      this.masterGain!.gain.cancelScheduledValues(t);
      this.masterGain!.gain.setValueAtTime(this.masterGain!.gain.value, t);
      this.masterGain!.gain.linearRampToValueAtTime(0, t + 0.1);
      
      // 2. Fade out the feedback loop to prevent "stuck" noise
      // We ramp the feedback to 0 over a short duration so the echo dies out naturally but quickly.
      if (this.feedbackGain) {
        this.feedbackGain.gain.cancelScheduledValues(t);
        this.feedbackGain.gain.setValueAtTime(this.feedbackGain.gain.value, t);
        this.feedbackGain.gain.linearRampToValueAtTime(0, t + 0.5);
      }

      const oldOsc = this.mainOsc;
      const oldVib = this.vibOsc;
      
      // Nullify immediately so UI/logic knows we are stopped
      this.mainOsc = null;
      this.vibOsc = null;
      
      setTimeout(() => {
        try {
            oldOsc.stop();
            oldVib?.stop();
            oldOsc.disconnect();
            oldVib?.disconnect();
        } catch (e) {
            // Ignore errors if already stopped
        }
      }, 150); // Wait for release + buffer
    }
  }

  public getByteTimeDomainData(dataArray: Uint8Array) {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(dataArray);
    }
  }

  // Helper for distortion
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