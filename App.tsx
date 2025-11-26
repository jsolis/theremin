
import React, { useState, useEffect } from 'react';
import PianoSurface from './components/PianoSurface';
import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import Metronome from './components/Metronome';
import AuthModal from './components/AuthModal';
import { audioEngine } from './services/audioEngine';
import { authService } from './services/authService';
import { DEFAULT_PRESET } from './constants';
import { SoundPreset, UserProfile } from './types';
import { Mic, User, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<number>(0);
  const [preset, setPreset] = useState<SoundPreset>(DEFAULT_PRESET);
  const [audioStarted, setAudioStarted] = useState(false);
  const [showKeySeparators, setShowKeySeparators] = useState(true);
  
  // Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
        setUser(currentUser);
    }
  }, []);

  const handleNoteChange = (note: string | null, freq: number) => {
    setActiveNote(note);
    setFrequency(freq);
    if (!audioStarted && note) {
        setAudioStarted(true);
    }
  };

  const handleLogout = async () => {
      await authService.logout();
      setUser(null);
  };

  // Initialize audio engine with default preset or shared preset from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCode = params.get('preset');

    if (sharedCode) {
      try {
        // Decode base64 and URI encoding to handle special characters
        const decoded = JSON.parse(decodeURIComponent(atob(sharedCode)));
        const newPreset = { ...DEFAULT_PRESET, ...decoded };
        setPreset(newPreset);
        audioEngine.setPreset(newPreset);
      } catch (e) {
        console.error("Failed to load shared preset:", e);
        audioEngine.setPreset(DEFAULT_PRESET);
      }
    } else {
      audioEngine.setPreset(DEFAULT_PRESET);
    }
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-white p-4 md:p-8 flex flex-col items-center justify-start md:justify-center font-sans">
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLoginSuccess={(u) => setUser(u)}
      />

      <div className="max-w-5xl w-full space-y-6 relative pb-10">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-4 pt-2 md:pt-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-neon-blue to-neon-purple rounded-full flex items-center justify-center shadow-neon">
                    <Mic className="text-black" size={20} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Lumina <span className="text-neon-blue font-light">Theremin</span></h1>
                    <p className="text-xs text-gray-500">Virtual Analog Synthesizer</p>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                    <div className="text-3xl font-mono font-bold text-neon-blue h-8">
                        {activeNote || <span className="opacity-20">--</span>}
                    </div>
                    <div className="text-xs font-mono text-gray-400 h-4">
                        {frequency > 0 ? `${frequency.toFixed(1)} Hz` : ''}
                    </div>
                </div>

                {/* User Profile Button */}
                <div className="relative group">
                    <button 
                        onClick={() => !user && setIsAuthModalOpen(true)}
                        className={`w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center transition-all ${
                            user 
                            ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/50' 
                            : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                        }`}
                        title={user ? user.email : "Login"}
                    >
                        <User size={20} />
                    </button>
                    
                    {/* Hover Menu for Logout */}
                    {user && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-800">
                                <p className="text-xs text-gray-500">Signed in as</p>
                                <p className="text-sm font-bold text-white truncate">{user.name}</p>
                            </div>
                            <button 
                                onClick={handleLogout}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-2"
                            >
                                <LogOut size={14} /> Sign Out
                            </button>
                        </div>
                    )}
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
            <PianoSurface 
                onActiveNoteChange={handleNoteChange} 
                showKeySeparators={showKeySeparators}
            />
        </div>

        {/* Metronome & Controls */}
        <Metronome />
        <Controls 
            preset={preset} 
            onPresetChange={setPreset} 
            showKeySeparators={showKeySeparators}
            onToggleKeySeparators={setShowKeySeparators}
            user={user}
            onLoginRequest={() => setIsAuthModalOpen(true)}
        />
        
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
