import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on parent, handle resize
    const resize = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const bufferLength = 2048;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // If audio context isn't ready or analyser missing, just draw a flat line
      if (!audioEngine.analyser) {
         ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         return;
      }

      audioEngine.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgba(10, 10, 10, 0.3)'; // Fade out effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00f3ff'; // Neon blue
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-32 rounded-lg bg-black border border-gray-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"
    />
  );
};

export default Visualizer;