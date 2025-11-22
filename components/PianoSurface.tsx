import React, { useState, useRef, useEffect, useMemo } from 'react';
import { audioEngine } from '../services/audioEngine';
import { MIN_FREQ, NOTES } from '../constants';

interface PianoSurfaceProps {
  onActiveNoteChange: (note: string | null, freq: number) => void;
  showKeySeparators: boolean;
}

const PianoSurface: React.FC<PianoSurfaceProps> = ({ onActiveNoteChange, showKeySeparators }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [cursorX, setCursorX] = useState<number>(0); // percentage 0-100
  
  // Use ref for callback to keep it stable inside event listeners without re-binding
  const onActiveNoteChangeRef = useRef(onActiveNoteChange);
  useEffect(() => {
      onActiveNoteChangeRef.current = onActiveNoteChange;
  }, [onActiveNoteChange]);

  // Generate keys logic
  const keys = useMemo(() => {
    const generatedKeys = [];
    const startOctave = 3;
    const endOctave = 6;
    let totalNotes = 0;

    // Count total notes first for width calculation
    for (let oct = startOctave; oct < endOctave; oct++) {
        totalNotes += 12;
    }
    totalNotes += 1; // High C

    const whiteKeyCount = (endOctave - startOctave) * 7 + 1;

    let whiteKeyIndex = 0;

    for (let oct = startOctave; oct < endOctave; oct++) {
      for (let i = 0; i < 12; i++) {
        const noteName = NOTES[i];
        const isBlack = noteName.includes('#');
        
        if (!isBlack) {
            const left = (whiteKeyIndex / whiteKeyCount) * 100;
            const width = (1 / whiteKeyCount) * 100;
            generatedKeys.push({
                note: `${noteName}${oct}`,
                type: 'white',
                left,
                width,
                frequency: 0
            });
            whiteKeyIndex++;
        } else {
            const left = (whiteKeyIndex / whiteKeyCount) * 100 - ((1 / whiteKeyCount) * 100 * 0.35);
            const width = (1 / whiteKeyCount) * 100 * 0.7;
            generatedKeys.push({
                note: `${noteName}${oct}`,
                type: 'black',
                left,
                width,
                frequency: 0
            });
        }
      }
    }
    // Add final C
    const left = (whiteKeyIndex / whiteKeyCount) * 100;
    const width = (1 / whiteKeyCount) * 100;
    generatedKeys.push({ note: `C${endOctave}`, type: 'white', left, width, frequency: 0 });

    return generatedKeys;
  }, []);

  const getFrequencyFromX = (xPercent: number) => {
    const p = Math.max(0, Math.min(1, xPercent));
    const totalSemitones = 36; // C3 to C6
    const semitonePos = p * totalSemitones;
    const frequency = MIN_FREQ * Math.pow(2, semitonePos / 12);
    
    const totalNoteIndex = Math.round(semitonePos);
    const octave = 3 + Math.floor(totalNoteIndex / 12);
    const noteName = NOTES[totalNoteIndex % 12];
    
    return { frequency, note: `${noteName}${octave}` };
  };

  const handleInput = (clientX: number, clientY: number, type: 'start' | 'move') => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Clamp values to keep sound playing correctly even if dragging slightly outside
    const xPercent = Math.max(0, Math.min(1, x / rect.width));
    const yPercent = Math.max(0, Math.min(1, 1 - (y / rect.height))); 

    // Update cursor visual
    setCursorX(xPercent * 100);

    const { frequency, note } = getFrequencyFromX(xPercent);
    
    // Min volume 0.2 so it doesn't go silent at the bottom
    const volume = Math.max(0.2, yPercent);

    if (type === 'start') {
        setIsPressed(true);
        audioEngine.startNote(frequency, volume);
        onActiveNoteChangeRef.current(note, frequency);
    } else {
        audioEngine.updateNote(frequency, volume);
        onActiveNoteChangeRef.current(note, frequency);
    }
  };

  // Global event listeners to handle dragging outside the component
  useEffect(() => {
    if (!isPressed) return;

    const handleGlobalMove = (e: PointerEvent) => {
      handleInput(e.clientX, e.clientY, 'move');
    };

    const handleGlobalUp = () => {
      setIsPressed(false);
      audioEngine.stopNote();
      onActiveNoteChangeRef.current(null, 0);
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [isPressed]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // Prevent text selection and default behaviors
    handleInput(e.clientX, e.clientY, 'start');
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-48 md:h-64 select-none cursor-crosshair overflow-hidden rounded-b-xl bg-gray-900 shadow-2xl touch-none"
      onPointerDown={onPointerDown}
    >
      {/* Render Keys */}
      {keys.map((key, i) => (
        <div
            key={i}
            className={`absolute top-0 border-b-4 rounded-b-sm pointer-events-none transition-colors duration-100
                ${key.type === 'white' 
                    ? `h-full bg-gray-200 border-gray-300 z-0 text-gray-400 flex items-end justify-center pb-2 text-xs font-mono ${showKeySeparators ? 'border-r border-r-gray-400' : ''}`
                    : 'h-[60%] bg-black border-gray-800 z-10 shadow-lg'
                }
            `}
            style={{
                left: `${key.left}%`,
                width: `${key.width}%`,
            }}
        >
           {key.type === 'white' && (key.note.includes('C') ? key.note : '')}
        </div>
      ))}

      {/* Active Overlay / Ribbon Effect */}
      <div 
        className="absolute inset-0 pointer-events-none z-20 bg-gradient-to-t from-neon-blue/10 to-transparent transition-opacity duration-75" 
        style={{ opacity: isPressed ? 0.5 : 0 }} 
      />
      
      {/* Cursor Line */}
      {isPressed && (
          <div 
            className="absolute top-0 bottom-0 w-1 bg-neon-blue shadow-[0_0_15px_#00f3ff] z-30 pointer-events-none"
            style={{ left: `${cursorX}%` }}
          />
      )}
    </div>
  );
};

export default PianoSurface;