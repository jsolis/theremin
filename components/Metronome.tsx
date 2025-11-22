import React, { useState, useEffect } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

const Metronome: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [signature, setSignature] = useState<'4/4' | '3/4'>('4/4');
  const [activeBeat, setActiveBeat] = useState<number>(-1);

  useEffect(() => {
      audioEngine.onMetronomeBeat = (beat) => {
          setActiveBeat(beat);
      };
      return () => {
          audioEngine.onMetronomeBeat = null;
      };
  }, []);

  const toggleMetronome = () => {
    if (isPlaying) {
      audioEngine.stopMetronome();
      setActiveBeat(-1);
    } else {
      audioEngine.startMetronome(bpm, signature);
    }
    setIsPlaying(!isPlaying);
  };

  const handleBpmChange = (value: string) => {
      const num = parseInt(value);
      if (isNaN(num)) {
          // Allow empty input for typing
          setBpm(0); 
          return;
      }
      setBpm(num);
      if (isPlaying) {
          const validBpm = Math.max(30, Math.min(300, num));
          audioEngine.setMetronome(validBpm, signature);
      }
  };

  const handleBlur = () => {
      const clamped = Math.max(30, Math.min(300, bpm));
      setBpm(clamped);
      if (isPlaying) {
          audioEngine.setMetronome(clamped, signature);
      }
  };

  const handleSignatureChange = (newSig: '4/4' | '3/4') => {
      setSignature(newSig);
      if (isPlaying) {
          audioEngine.setMetronome(bpm, newSig);
      }
  }

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          audioEngine.stopMetronome();
      }
  }, []);

  const beatsPerMeasure = signature === '3/4' ? 3 : 4;

  return (
    <div className="bg-panel-bg border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 mt-6">
      <div className="flex items-center gap-2 text-neon-blue font-bold border-gray-800 sm:border-r sm:pr-4">
          <Clock size={20} />
          <span>METRONOME</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 flex-1 w-full sm:w-auto">
          {/* BPM Control */}
          <div className="flex items-center gap-2 bg-black rounded p-1 border border-gray-700">
             <input 
                type="number"
                value={bpm || ''}
                onChange={(e) => handleBpmChange(e.target.value)}
                onBlur={handleBlur}
                className="w-16 bg-transparent text-white text-center font-mono outline-none appearance-none"
             />
             <span className="text-xs text-gray-500 font-bold pr-2">BPM</span>
          </div>

          {/* Time Signature */}
          <div className="flex gap-1 bg-black rounded p-1 border border-gray-700">
              {(['4/4', '3/4'] as const).map(sig => (
                  <button
                    key={sig}
                    onClick={() => handleSignatureChange(sig)}
                    className={`px-2 py-1 text-xs rounded font-bold transition-colors ${
                        signature === sig ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                      {sig}
                  </button>
              ))}
          </div>

          {/* Visual Beat Indicators */}
          <div className="flex gap-2 mx-2 h-4 items-center">
            {Array.from({ length: beatsPerMeasure }).map((_, i) => (
               <div 
                 key={i}
                 className={`rounded-full transition-all duration-75 ${
                     activeBeat === i 
                     ? (i === 0 ? 'bg-neon-purple shadow-[0_0_12px_#bc13fe] w-4 h-4' : 'bg-neon-blue shadow-[0_0_10px_#00f3ff] w-3 h-3') 
                     : 'bg-gray-800 w-2 h-2'
                 }`}
               />
            ))}
          </div>
      </div>

      <button
        onClick={toggleMetronome}
        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all w-full sm:w-auto justify-center ${
            isPlaying 
            ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
            : 'bg-neon-blue/10 text-neon-blue border border-neon-blue/50 hover:bg-neon-blue/20 shadow-[0_0_10px_rgba(0,243,255,0.2)]'
        }`}
      >
          {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {isPlaying ? 'STOP' : 'START'}
      </button>
    </div>
  );
};

export default Metronome;