import React, { useState } from 'react';
import { SoundPreset, WaveformType } from '../types';
import { generatePreset } from '../services/geminiService';
import { DEFAULT_PRESET } from '../constants';
import { Loader2, Wand2, RefreshCcw, Share2, Check } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface ControlsProps {
  preset: SoundPreset;
  onPresetChange: (preset: SoundPreset) => void;
  showKeySeparators: boolean;
  onToggleKeySeparators: (show: boolean) => void;
}

const Controls: React.FC<ControlsProps> = ({ preset, onPresetChange, showKeySeparators, onToggleKeySeparators }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    
    const newPreset = await generatePreset(prompt);
    
    if (newPreset) {
        onPresetChange(newPreset);
        audioEngine.setPreset(newPreset);
    } else {
        setError("Failed to generate preset. Check API Key or try again.");
    }
    
    setIsLoading(false);
  };

  const handleChange = (field: keyof SoundPreset, value: any) => {
    const newPreset = { ...preset, [field]: value };
    onPresetChange(newPreset);
    audioEngine.setPreset(newPreset);
  };

  const handleShare = () => {
      try {
          const code = btoa(encodeURIComponent(JSON.stringify(preset)));
          const url = `${window.location.origin}${window.location.pathname}?preset=${code}`;
          navigator.clipboard.writeText(url);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      } catch (e) {
          console.error("Failed to share", e);
      }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 bg-panel-bg rounded-xl border border-gray-800 mt-6">
      
      {/* AI Section */}
      <div className="lg:col-span-1 space-y-4 border-r border-gray-800 pr-6">
        <div className="flex items-center gap-2 text-neon-purple font-bold mb-2">
            <Wand2 size={20} />
            <h3>AI Tone Designer</h3>
        </div>
        <p className="text-xs text-gray-400">Describe a sound (e.g. "Scary ghost in a cave", "8-bit video game jump")</p>
        <div className="flex gap-2">
            <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe sound..."
                className="flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:border-neon-purple focus:outline-none focus:shadow-neon-purple transition-all text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
            />
            <button 
                onClick={handleAiGenerate}
                disabled={isLoading}
                className="bg-neon-purple/20 hover:bg-neon-purple/40 text-neon-purple border border-neon-purple rounded px-3 py-2 transition-colors disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
            </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        {preset.name !== DEFAULT_PRESET.name && (
             <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-800">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Current Preset</p>
                <p className="text-sm font-medium text-white">{preset.name}</p>
             </div>
        )}
      </div>

      {/* Manual Controls */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        
        {/* Waveform */}
        <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Waveform</label>
            <div className="flex bg-black rounded p-1 border border-gray-800">
                {Object.values(WaveformType).map((type) => (
                    <button
                        key={type}
                        onClick={() => handleChange('waveform', type)}
                        className={`flex-1 py-1 text-xs rounded capitalize transition-colors ${
                            preset.waveform === type 
                            ? 'bg-gray-700 text-white shadow' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {type}
                    </button>
                ))}
            </div>
        </div>

        {/* Sliders Group 1 */}
        <div className="space-y-4">
            <ControlSlider 
                label="Vibrato Depth" 
                value={preset.vibratoDepth} 
                min={0} max={50} 
                onChange={(v) => handleChange('vibratoDepth', v)} 
            />
             <ControlSlider 
                label="Vibrato Speed (Hz)" 
                value={preset.vibratoSpeed} 
                min={0} max={20} 
                onChange={(v) => handleChange('vibratoSpeed', v)} 
            />
        </div>

        {/* Sliders Group 2 */}
        <div className="space-y-4">
            <ControlSlider 
                label="Delay Time (s)" 
                value={preset.delayTime} 
                min={0} max={1} step={0.01}
                onChange={(v) => handleChange('delayTime', v)} 
            />
             <ControlSlider 
                label="Feedback" 
                value={preset.feedback} 
                min={0} max={0.9} step={0.01}
                onChange={(v) => handleChange('feedback', v)} 
            />
        </div>
         
         {/* Sliders Group 3 */}
        <div className="space-y-4">
             <ControlSlider 
                label="Reverb Mix" 
                value={preset.reverbMix} 
                min={0} max={1} step={0.05}
                onChange={(v) => handleChange('reverbMix', v)} 
            />
             <ControlSlider 
                label="Distortion" 
                value={preset.distortion} 
                min={0} max={100} 
                onChange={(v) => handleChange('distortion', v)} 
            />
            
            {/* Visual Settings & Share & Reset */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
                 <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2 cursor-pointer hover:text-gray-200">
                    <input 
                        type="checkbox" 
                        checked={showKeySeparators}
                        onChange={(e) => onToggleKeySeparators(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-600 bg-black text-neon-blue focus:ring-1 focus:ring-neon-blue focus:ring-offset-0"
                    />
                    Key Lines
                 </label>

                 <div className="flex items-center gap-4">
                    <button 
                        onClick={handleShare}
                        className={`text-xs flex items-center gap-1 transition-colors ${isCopied ? 'text-green-400' : 'text-neon-blue hover:text-white'}`}
                        title="Copy preset link to clipboard"
                    >
                        {isCopied ? <Check size={12} /> : <Share2 size={12} />}
                        {isCopied ? 'Copied!' : 'Share'}
                    </button>
                    
                    <div className="w-px h-3 bg-gray-700"></div>

                    <button 
                        onClick={() => { onPresetChange(DEFAULT_PRESET); audioEngine.setPreset(DEFAULT_PRESET); setPrompt('') }}
                        className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                    >
                        <RefreshCcw size={12} /> Reset
                    </button>
                 </div>
            </div>
        </div>

      </div>
    </div>
  );
};

const ControlSlider: React.FC<{ 
    label: string; 
    value: number; 
    min: number; 
    max: number; 
    step?: number;
    onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => (
    <div>
        <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400 uppercase">{label}</span>
            <span className="text-neon-blue font-mono">{value}</span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-neon-blue hover:accent-neon-purple"
        />
    </div>
);

export default Controls;