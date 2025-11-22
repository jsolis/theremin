import { GoogleGenAI, Type } from "@google/genai";
import { SoundPreset, WaveformType } from "../types";

// Define the preset schema for Gemini
const presetSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "A creative name for the sound preset" },
    waveform: { 
        type: Type.STRING, 
        enum: [WaveformType.SINE, WaveformType.SQUARE, WaveformType.SAWTOOTH, WaveformType.TRIANGLE],
        description: "The basic waveform shape"
    },
    vibratoDepth: { type: Type.NUMBER, description: "Intensity of pitch modulation (0-50)" },
    vibratoSpeed: { type: Type.NUMBER, description: "Speed of pitch modulation in Hz (0-20)" },
    delayTime: { type: Type.NUMBER, description: "Delay time in seconds (0-1.0)" },
    feedback: { type: Type.NUMBER, description: "Delay feedback amount (0-0.9)" },
    distortion: { type: Type.NUMBER, description: "Distortion amount (0-50)" },
    reverbMix: { type: Type.NUMBER, description: "Reverb/Ambience amount (0-1.0)" }
  },
  required: ["name", "waveform", "vibratoDepth", "vibratoSpeed", "delayTime", "feedback", "distortion", "reverbMix"]
};

export const generatePreset = async (description: string): Promise<SoundPreset | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key not found");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Create a synthesizer sound preset that matches this description: "${description}". 
      It should be suitable for a theremin-like instrument. Use Reverb to add atmosphere.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: presetSchema
      }
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    return data as SoundPreset;
  } catch (error) {
    console.error("Error generating preset:", error);
    return null;
  }
};