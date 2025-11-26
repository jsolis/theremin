
import React, { useState, useEffect } from 'react';
import { SoundPreset, WaveformType, UserProfile } from '../types';
import { generatePreset } from '../services/geminiService';
import { cloudService } from '../services/cloudService';
import { DEFAULT_PRESET } from '../constants';
import { Loader2, Wand2, RefreshCcw, Share2, Check, Save, FolderOpen, Trash2, X, Cloud, Laptop, LogIn, Lock, Pencil } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface ControlsProps {
  preset: SoundPreset;
  onPresetChange: (preset: SoundPreset) => void;
  showKeySeparators: boolean;
  onToggleKeySeparators: (show: boolean) => void;
  user: UserProfile | null;
  onLoginRequest: () => void;
}

const Controls: React.FC<ControlsProps> = ({ 
    preset, 
    onPresetChange, 
    showKeySeparators, 
    onToggleKeySeparators,
    user,
    onLoginRequest
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Library State
  const [libraryType, setLibraryType] = useState<'device' | 'cloud'>('device');
  const [savedPresets, setSavedPresets] = useState<SoundPreset[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  
  // Save/Rename Flow State
  const [isSaving, setIsSaving] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load Presets Logic
  const fetchPresets = async () => {
    setIsLibraryLoading(true);
    if (libraryType === 'device') {
        try {
            const stored = localStorage.getItem('lumina_theremin_presets');
            setSavedPresets(stored ? JSON.parse(stored) : []);
        } catch (e) {
            console.error("Failed to load local presets", e);
        }
    } else if (libraryType === 'cloud' && user) {
        try {
            const cloudPresets = await cloudService.getPresets(user.id);
            setSavedPresets(cloudPresets);
        } catch (e) {
            console.error("Failed to load cloud presets", e);
        }
    } else {
        setSavedPresets([]);
    }
    setIsLibraryLoading(false);
  };

  // Trigger fetch on tab change or user change
  useEffect(() => {
    fetchPresets();
  }, [libraryType, user]);

  // If user logs out while on cloud tab, switch to device
  useEffect(() => {
    if (!user && libraryType === 'cloud') {
        setLibraryType('device');
    }
  }, [user, libraryType]);

  // Initialize save name when entering save mode or when preset changes
  useEffect(() => {
    if (isSaving) {
        setSaveName(preset.name);
    }
  }, [isSaving, preset.name]);

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

  const handleReset = () => {
      onPresetChange(DEFAULT_PRESET);
      audioEngine.setPreset(DEFAULT_PRESET);
      setPrompt('');
      
      const url = new URL(window.location.href);
      url.searchParams.delete('preset');
      window.history.pushState({}, '', url);
  };

  const startSave = () => {
      // If asking to save to cloud but not logged in, prompt login
      if (libraryType === 'cloud' && !user) {
          onLoginRequest();
          return;
      }
      setSaveName(preset.name);
      setIsRenaming(false);
      setIsSaving(true);
  };

  const startRename = () => {
      if (libraryType === 'cloud' && !user) {
          onLoginRequest();
          return;
      }
      setSaveName(preset.name);
      setIsRenaming(true);
      setIsSaving(true);
  };

  const confirmSave = async () => {
    if (!saveName.trim()) return;
    
    const oldName = preset.name;
    const newPreset: SoundPreset = { ...preset, name: saveName };
    
    try {
        if (libraryType === 'device') {
            const updatedList = [...savedPresets];
            
            // If renaming and name changed, remove the old entry
            if (isRenaming && oldName !== saveName) {
                const oldIndex = updatedList.findIndex(p => p.name === oldName);
                if (oldIndex !== -1) updatedList.splice(oldIndex, 1);
            }

            // Add or Update the new entry
            const existingIndex = updatedList.findIndex(p => p.name === saveName);
            if (existingIndex >= 0) {
                updatedList[existingIndex] = newPreset;
            } else {
                updatedList.push(newPreset);
            }
            
            setSavedPresets(updatedList);
            localStorage.setItem('lumina_theremin_presets', JSON.stringify(updatedList));
            
            // Update active preset
            onPresetChange(newPreset);
            audioEngine.setPreset(newPreset);

        } else if (libraryType === 'cloud' && user) {
            setIsLibraryLoading(true);
            
            // If renaming, delete old from cloud first
            if (isRenaming && oldName !== saveName) {
                await cloudService.deletePreset(user.id, oldName);
            }
            
            const saved = await cloudService.savePreset(user.id, newPreset);
            
            // CRITICAL: Update active preset with the returned one (which has the correct cloud ID)
            onPresetChange(saved);
            audioEngine.setPreset(saved);
            
            await fetchPresets(); // Refresh list to get new IDs/States
        }

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
        console.error("Failed to save preset", e);
        alert("Could not save preset.");
    } finally {
        setIsSaving(false);
        setIsRenaming(false);
    }
  };

  const cancelSave = () => {
      setIsSaving(false);
      setIsRenaming(false);
      setSaveName('');
  };

  const handleLoadPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    if (!name) return;
    const found = savedPresets.find(p => p.name === name);
    if (found) {
        onPresetChange(found);
        audioEngine.setPreset(found);
    }
  };

  const handleDeletePreset = async () => {
    if (!window.confirm(`Delete preset "${preset.name}" from ${libraryType === 'cloud' ? 'Cloud' : 'Device'} Library?`)) return;
    
    if (libraryType === 'device') {
        const updatedList = savedPresets.filter(p => p.name !== preset.name);
        setSavedPresets(updatedList);
        localStorage.setItem('lumina_theremin_presets', JSON.stringify(updatedList));
    } else if (libraryType === 'cloud' && user) {
        setIsLibraryLoading(true);
        await cloudService.deletePreset(user.id, preset.name);
        await fetchPresets();
    }
    
    // Mark as unsaved
    if (savedPresets.some(p => p.name === preset.name)) {
        const newPreset = { ...preset, name: `${preset.name} (Unsaved)` };
        onPresetChange(newPreset);
    }
  };

  const isCurrentPresetSaved = savedPresets.some(p => p.name === preset.name);

  return (
    <div className="flex flex-col gap-8 p-6 bg-panel-bg rounded-xl border border-gray-800 mt-6 shadow-2xl">
      
      {/* Top Section: Manual Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Column 1: Waveform & Vibrato */}
        <div className="space-y-6">
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

        {/* Column 2: Delay & Feedback */}
        <div className="space-y-6">
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
            <ControlSlider 
                label="Reverb Mix" 
                value={preset.reverbMix} 
                min={0} max={1} step={0.05}
                onChange={(v) => handleChange('reverbMix', v)} 
            />
        </div>
         
         {/* Column 3: Distortion & Settings */}
        <div className="space-y-6 flex flex-col h-full">
             <ControlSlider 
                label="Distortion" 
                value={preset.distortion} 
                min={0} max={100} 
                onChange={(v) => handleChange('distortion', v)} 
            />
            
            <div className="flex-1 min-h-[1rem]"></div>

            <div className="space-y-4 pt-2">
                 <label className="flex items-center gap-2 cursor-pointer hover:text-gray-200 w-fit">
                    <input 
                        type="checkbox" 
                        checked={showKeySeparators}
                        onChange={(e) => onToggleKeySeparators(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-black text-neon-blue focus:ring-1 focus:ring-neon-blue focus:ring-offset-0"
                    />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Show Key Lines</span>
                 </label>

                 <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
                    <button 
                        onClick={handleShare}
                        className={`flex-1 py-2 rounded text-xs font-medium border flex items-center justify-center gap-2 transition-colors ${
                            isCopied 
                            ? 'bg-green-500/10 text-green-400 border-green-500/50' 
                            : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                        {isCopied ? <Check size={14} /> : <Share2 size={14} />}
                        {isCopied ? 'Copied' : 'Share'}
                    </button>

                    <button 
                        onClick={handleReset}
                        className="flex-1 py-2 rounded text-xs font-medium border border-gray-800 text-gray-500 hover:text-red-400 hover:border-red-900/50 hover:bg-red-900/10 flex items-center justify-center gap-2 transition-colors"
                    >
                        <RefreshCcw size={14} /> Reset
                    </button>
                 </div>
            </div>
        </div>
      </div>

      <div className="w-full h-px bg-gray-800/50"></div>

      {/* Bottom Section: Sound Design & Library */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* AI Section */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-neon-purple font-bold">
                <Wand2 size={20} />
                <h3>Sound Design</h3>
            </div>
            <p className="text-xs text-gray-400">Describe a sound to generate a new preset using Gemini AI.</p>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. 8-bit jump, Ghostly wail..."
                    className="flex-1 bg-black border border-gray-700 rounded px-3 py-2 text-sm focus:border-neon-purple focus:outline-none focus:shadow-neon-purple transition-all text-white placeholder-gray-600"
                    onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                />
                <button 
                    onClick={handleAiGenerate}
                    disabled={isLoading}
                    className="bg-neon-purple/20 hover:bg-neon-purple/40 text-neon-purple border border-neon-purple rounded px-4 py-2 transition-colors disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                </button>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        {/* Library Section */}
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-neon-blue font-bold">
                        <FolderOpen size={20} />
                        <h3>Library</h3>
                    </div>
                    
                    {/* Library Toggle */}
                    <div className="flex bg-black rounded p-0.5 border border-gray-800">
                        <button
                            onClick={() => setLibraryType('device')}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-bold rounded transition-colors ${
                                libraryType === 'device' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            <Laptop size={10} /> Device
                        </button>
                        <button
                            onClick={() => {
                                if (!user) onLoginRequest();
                                else setLibraryType('cloud');
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-bold rounded transition-colors ${
                                libraryType === 'cloud' 
                                    ? 'bg-neon-blue/20 text-neon-blue' 
                                    : (user ? 'text-gray-500 hover:text-gray-300' : 'text-gray-700 hover:text-gray-500')
                            }`}
                        >
                            {user ? <Cloud size={10} /> : <Lock size={10} />} Cloud
                        </button>
                    </div>
                </div>

                {!isSaving && (
                    <div className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded border border-gray-800 truncate max-w-[120px]">
                        Active: <span className="text-gray-300 font-medium">{preset.name}</span>
                    </div>
                )}
            </div>
            
            <div className="flex gap-2 h-10">
                {isSaving ? (
                    // Saving UI
                    <>
                        <input 
                            type="text" 
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            placeholder="Preset Name"
                            autoFocus
                            className={`flex-1 bg-black border rounded px-3 py-2 text-sm text-white focus:outline-none ${isRenaming ? 'border-neon-purple ring-1 ring-neon-purple' : 'border-neon-blue'}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmSave();
                                if (e.key === 'Escape') cancelSave();
                            }}
                        />
                        <button 
                            onClick={confirmSave}
                            className="flex items-center justify-center px-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded transition-colors"
                        >
                            <Check size={18} />
                        </button>
                        <button 
                            onClick={cancelSave}
                            className="flex items-center justify-center px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </>
                ) : (
                    // Default UI
                    <>
                        {libraryType === 'cloud' && !user ? (
                             <button 
                                onClick={onLoginRequest}
                                className="flex-1 bg-black border border-gray-700 border-dashed rounded px-3 py-2 text-sm text-gray-500 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
                             >
                                <LogIn size={14} /> Login to access Cloud Library
                             </button>
                        ) : (
                             <div className="relative flex-1">
                                <select 
                                    className="w-full h-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-neon-blue outline-none cursor-pointer disabled:opacity-50"
                                    onChange={handleLoadPreset}
                                    value={isCurrentPresetSaved ? preset.name : ""}
                                    disabled={isLibraryLoading}
                                >
                                    <option value="" disabled>
                                        {isLibraryLoading ? "Loading..." : `Load ${libraryType === 'cloud' ? 'cloud' : 'device'} preset...`}
                                    </option>
                                    {savedPresets.map((p, i) => (
                                        <option key={i} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                                {isLibraryLoading && (
                                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Loader2 size={14} className="animate-spin text-gray-500" />
                                    </div>
                                )}
                            </div>
                        )}

                        <button 
                            onClick={startSave}
                            className={`flex items-center justify-center gap-2 px-3 border text-xs font-bold rounded transition-colors ${
                                saveSuccess 
                                ? 'bg-green-500/10 border-green-500/50 text-green-400' 
                                : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                            }`}
                            title={`Save new copy to ${libraryType === 'cloud' ? 'Cloud' : 'Device'}`}
                        >
                            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
                        </button>
                        
                        <button 
                            onClick={startRename}
                            disabled={!isCurrentPresetSaved}
                            className="flex items-center justify-center px-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Rename current preset"
                        >
                            <Pencil size={16} />
                        </button>

                         <button 
                            onClick={handleDeletePreset}
                            disabled={!isCurrentPresetSaved}
                            className="flex items-center justify-center px-3 bg-gray-900 hover:bg-red-900/30 border border-gray-800 hover:border-red-800 text-gray-500 hover:text-red-400 text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
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
