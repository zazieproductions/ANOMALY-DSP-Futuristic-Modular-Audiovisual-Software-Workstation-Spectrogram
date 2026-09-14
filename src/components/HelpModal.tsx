import React from 'react';
import { X, Zap, Layers, Activity, Radio, Cpu, Sparkles, BookOpen } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none font-mono text-xs">
      <div className="bg-[#0b0f19] border border-cyan-500/40 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col text-slate-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1c273c] bg-[#0e1422]">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider">ZIAA // ANOMALY-DSP ARCHITECTURE</h2>
              <p className="text-[10px] text-slate-400">Experimental Audiovisual Modular Simulation & Spectrogram Workstation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-[11px] leading-relaxed">
          {/* Section: Overview */}
          <div className="bg-[#070b13] p-3 rounded border border-[#182335]">
            <h3 className="font-bold text-cyan-300 flex items-center gap-1.5 mb-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              1. Max/MSP & TouchDesigner Modular Hybrid
            </h3>
            <p className="text-slate-400">
              This environment merges the audio signal graph workflow of <b>Max/MSP</b> (signal cords, biquad filters, 
              envelope followers, matrix routing) with the real-time visual operator pipeline of <b>TouchDesigner</b> (TOP 
              operators, feedback trails, texture shaders, spatial cartography) and the precision transport of professional DAWs.
            </p>
          </div>

          {/* Section: Audio Upload */}
          <div className="bg-[#070b13] p-3 rounded border border-[#182335]">
            <h3 className="font-bold text-emerald-300 flex items-center gap-1.5 mb-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              2. Desktop Audio Upload & Web Audio DSP
            </h3>
            <p className="text-slate-400">
              Drag-and-drop any MP3, WAV, FLAC, or OGG file from your computer into the left sidebar. The browser decodes the audio 
              into high-resolution floating-point buffers, computes real waveforms, dynamic transient peaks, and drives 
              the 32-band FFT analyzer, waterfall spectrogram, and volumetric psychedelic graphics in real time.
            </p>
          </div>

          {/* Section: ZIAA Speculative Acoustical Archive */}
          <div className="bg-[#070b13] p-3 rounded border border-[#182335]">
            <h3 className="font-bold text-pink-300 flex items-center gap-1.5 mb-1.5">
              <Radio className="w-4 h-4 text-pink-400" />
              3. ZIAA Speculative Research Lab
            </h3>
            <p className="text-slate-400">
              Integrated with the research archive of the <i>Zazie Institute of Applied Anomalies (ZIAA)</i>: featuring algorithmic 
              simulations of <b>ZIAA-P-0128: Room-Memory Membrane Study</b> (concentric aluminium resonator with contact piezo pickups), 
              hypothetical acoustic patents, and non-linear modal resonances.
            </p>
          </div>

          {/* Section: Hotkeys */}
          <div className="bg-[#070b13] p-3 rounded border border-[#182335]">
            <h3 className="font-bold text-amber-300 flex items-center gap-1.5 mb-1.5">
              <Cpu className="w-4 h-4 text-amber-400" />
              4. Interactive Controls & Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 mt-2">
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">Space</kbd> Play / Pause</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">Click + Drag Canvas</kbd> Orbit 3D Camera</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">Scroll Wheel</kbd> Zoom In / Out</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">Click & Drag Socket</kbd> Patch Signal Cords</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">Click Cord</kbd> Sever / Disconnect</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">Waveform Scrub</kbd> Seek Playhead</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1c273c] bg-[#0e1422] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded cursor-pointer transition-colors"
          >
            ENTER WORKSPACE
          </button>
        </div>
      </div>
    </div>
  );
};
