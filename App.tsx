import React, { useState, useEffect } from 'react';
import PianoSurface from './components/PianoSurface';
import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import { audioEngine } from './services/audioEngine';
import { DEFAULT_PRESET } from './constants';
import { SoundPreset } from './types';
import { Mic } from 'lucide-react';

const App: React.FC = () => {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<number>(0);
  const [preset, setPreset] = useState<SoundPreset>(DEFAULT_PRESET);
  const [audioStarted, setAudioStarted] = useState(false);

  const handleNoteChange = (note: string | null, freq: number) => {
    setActiveNote(note);
    setFrequency(freq);
    if (!audioStarted && note) {
        setAudioStarted(true);
    }
  };

  // Initialize audio engine with default preset once
  useEffect(() => {
    audioEngine.setPreset(preset);
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-white p-4 md:p-8 flex flex-col items-center justify-center font-sans">
      
      <div className="max-w-5xl w-full space-y-6 relative">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-neon-blue to-neon-purple rounded-full flex items-center justify-center shadow-neon">
                    <Mic className="text-black" size={20} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Lumina <span className="text-neon-blue font-light">Theremin</span></h1>
                    <p className="text-xs text-gray-500">Virtual Analog Synthesizer</p>
                </div>
            </div>
            
            <div className="text-right">
                <div className="text-3xl font-mono font-bold text-neon-blue h-8">
                    {activeNote || <span className="opacity-20">--</span>}
                </div>
                <div className="text-xs font-mono text-gray-400 h-4">
                    {frequency > 0 ? `${frequency.toFixed(1)} Hz` : ''}
                </div>
            </div>
        </header>

        {/* Main Visualizer */}
        <div className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative">
                <Visualizer />
            </div>
        </div>

        {/* Piano / Ribbon Controller */}
        <div className="relative">
            <div className="absolute -top-3 left-0 right-0 flex justify-between px-2 z-50 pointer-events-none">
                {/* Markers for octaves could go here */}
            </div>
            <PianoSurface onActiveNoteChange={handleNoteChange} />
        </div>

        {/* Controls Panel */}
        <Controls preset={preset} onPresetChange={setPreset} />
        
        {/* Footer Info */}
         <footer className="text-center text-gray-600 text-xs mt-12">
            <p>Slide horizontally to control Pitch • Slide vertically to control Volume</p>
            <p className="mt-1 opacity-50">Powered by Web Audio API & Gemini</p>
        </footer>

      </div>
    </div>
  );
};

export default App;
