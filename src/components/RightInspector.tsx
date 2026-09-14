import React, { useState, useRef, useEffect } from 'react';
import { DspParameters, ColorPalette, AudioTelemetry } from '../types/dsp';
import { 
  Sliders, 
  Sparkles, 
  Layers, 
  Activity, 
  Radio, 
  ChevronDown, 
  ChevronRight, 
  Compass, 
  Sun, 
  Zap, 
  Eye, 
  RotateCw,
  Palette
} from 'lucide-react';

interface RightInspectorProps {
  params: DspParameters;
  onUpdateParams: (newParams: Partial<DspParameters>) => void;
  telemetry: AudioTelemetry;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  params,
  onUpdateParams,
  telemetry,
  isOpen,
  onToggleOpen,
}) => {
  // Collapsible nested section states
  const [sections, setSections] = useState({
    hallucination: true,
    filter: true,
    modulation: true,
    visual: true,
    xyPad: true,
  });

  const toggleSection = (s: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [s]: !prev[s] }));
  };

  // XY Pad interaction
  const xyPadRef = useRef<HTMLDivElement>(null);
  const isDraggingXY = useRef(false);

  const handleXYMouseDown = (e: React.MouseEvent) => {
    isDraggingXY.current = true;
    updateXY(e);
  };

  const handleXYMouseMove = (e: React.MouseEvent) => {
    if (isDraggingXY.current) {
      updateXY(e);
    }
  };

  const handleXYMouseUp = () => {
    isDraggingXY.current = false;
  };

  const updateXY = (e: React.MouseEvent) => {
    if (!xyPadRef.current) return;
    const rect = xyPadRef.current.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, -(((e.clientY - rect.top) / rect.height) * 2 - 1)));

    onUpdateParams({
      xyPadX: x,
      xyPadY: y,
      // Map X to Haas width or rotation
      stereoWidth: Math.max(0, 1 + x),
      // Map Y to Filter cutoff
      filterCutoff: Math.max(80, Math.min(18000, 5000 + y * 4500)),
    });
  };

  // LFO preview canvas
  const lfoCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let animId: number;
    let phase = 0;

    const drawLfo = () => {
      const canvas = lfoCanvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(drawLfo);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(drawLfo);
        return;
      }

      phase += 0.04 * params.lfo1Rate;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#070a10';
      ctx.fillRect(0, 0, w, h);

      // Center line
      ctx.strokeStyle = '#1a2436';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Waveform
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const t = (x / w) * Math.PI * 4 + phase;
        let y = 0;
        if (params.lfo1Shape === 'sine') {
          y = Math.sin(t);
        } else if (params.lfo1Shape === 'triangle') {
          y = (Math.asin(Math.sin(t)) * 2) / Math.PI;
        } else if (params.lfo1Shape === 'square') {
          y = Math.sin(t) >= 0 ? 1 : -1;
        } else if (params.lfo1Shape === 'saw') {
          y = (t % (Math.PI * 2)) / Math.PI - 1;
        } else {
          y = (Math.random() - 0.5) * 2;
        }

        const py = h / 2 - y * (h * 0.38) * params.lfo1Depth;
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();

      animId = requestAnimationFrame(drawLfo);
    };

    animId = requestAnimationFrame(drawLfo);
    return () => cancelAnimationFrame(animId);
  }, [params.lfo1Rate, params.lfo1Shape, params.lfo1Depth]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className="w-8 bg-[#0c101a] border-l border-[#1a2333] flex flex-col items-center py-4 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer select-none"
        title="Open Effects & Modulation Inspector"
      >
        <ChevronRight className="w-4 h-4 mb-3" />
        <span className="text-[10px] font-mono [writing-mode:vertical-lr] tracking-widest uppercase">
          DSP & MODULATION
        </span>
      </button>
    );
  }

  const palettes: { id: ColorPalette; label: string; color: string }[] = [
    { id: 'acid-neon', label: 'Acid Neon', color: '#00f0ff' },
    { id: 'obsidian-cyan', label: 'Obsidian Cyan', color: '#0077ff' },
    { id: 'solar-flare', label: 'Solar Flare', color: '#ffaa00' },
    { id: 'infrared', label: 'Infrared', color: '#ff0055' },
    { id: 'matrix-emerald', label: 'Matrix Emerald', color: '#39ff14' },
    { id: 'spectral-void', label: 'Spectral Void', color: '#e2e8f0' },
  ];

  return (
    <aside className="w-76 bg-[#090d15] border-l border-[#1a2333] flex flex-col h-full overflow-y-auto select-none font-mono text-xs text-slate-300 scrollbar-thin">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#0e1421] border-b border-[#1b2538]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 tracking-wider text-[11px]">
            DSP & MODULATION STACK
          </span>
        </div>
        <button
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col p-2.5 gap-3">
        {/* SECTION 1: Hallucinogenic DSP Console */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('hallucination')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-purple-300 text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              HALLUCINOGENIC DSP CONSOLE
            </span>
            {sections.hallucination ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {sections.hallucination && (
            <div className="p-2.5 flex flex-col gap-2.5 text-[10px]">
              {/* Haas Psychoacoustic Width */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>HAAS STEREO WIDTH:</span>
                  <span className="text-cyan-300">{(params.stereoWidth * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={params.stereoWidth}
                  onChange={(e) => onUpdateParams({ stereoWidth: Number(e.target.value) })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Bitcrush Decimator */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>BITCRUSH QUANTIZE:</span>
                  <span className="text-pink-300">{params.bitcrushBits}-BIT</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={params.bitcrushBits}
                  onChange={(e) => onUpdateParams({ bitcrushBits: Number(e.target.value) })}
                  className="w-full accent-pink-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Space Reverb Wet & Decay */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>CELESTIAL REVERB WET:</span>
                  <span className="text-emerald-300">{(params.reverbWet * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={params.reverbWet}
                  onChange={(e) => onUpdateParams({ reverbWet: Number(e.target.value) })}
                  className="w-full accent-emerald-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Tape Flutter / Wow */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>TAPE FLUTTER / DRIFT:</span>
                  <span className="text-amber-300">{(params.tapeFlutter * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={params.tapeFlutter}
                  onChange={(e) => onUpdateParams({ tapeFlutter: Number(e.target.value) })}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Sub-Harmonic Generator */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>SUB-HARMONIC BOOST:</span>
                  <span className="text-cyan-300">{(params.subHarmonic * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.subHarmonic}
                  onChange={(e) => onUpdateParams({ subHarmonic: Number(e.target.value) })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Spectral Filter Bank */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('filter')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-cyan-300 text-[11px] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              SPECTRAL FILTER BANK
            </span>
            {sections.filter ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {sections.filter && (
            <div className="p-2.5 flex flex-col gap-2.5 text-[10px]">
              {/* Filter Type Selector */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">FILTER TOPOLOGY:</span>
                <div className="flex items-center gap-1">
                  {(['lowpass', 'highpass', 'bandpass', 'notch'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => onUpdateParams({ filterType: t })}
                      className={`px-1.5 py-0.5 rounded uppercase text-[9px] transition-colors ${
                        params.filterType === t
                          ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {t.slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cutoff Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>CUTOFF FREQUENCY:</span>
                  <span className="text-cyan-300 font-bold">{Math.round(params.filterCutoff)} Hz</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="19000"
                  value={params.filterCutoff}
                  onChange={(e) => onUpdateParams({ filterCutoff: Number(e.target.value) })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Resonance Q */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>RESONANCE (Q):</span>
                  <span className="text-pink-300 font-bold">{params.filterResonance.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={params.filterResonance}
                  onChange={(e) => onUpdateParams({ filterResonance: Number(e.target.value) })}
                  className="w-full accent-pink-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Saturation Drive */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>ANALOG DRIVE:</span>
                  <span className="text-amber-300 font-bold">{params.filterDrive.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.2"
                  value={params.filterDrive}
                  onChange={(e) => onUpdateParams({ filterDrive: Number(e.target.value) })}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Modulation Matrix & LFO Engine */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('modulation')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-pink-300 text-[11px] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              LFO 1 // MODULATOR
            </span>
            {sections.modulation ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {sections.modulation && (
            <div className="p-2.5 flex flex-col gap-2.5 text-[10px]">
              {/* LFO Oscilloscope Preview */}
              <div className="relative w-full h-12 bg-[#05070c] border border-[#182333] rounded overflow-hidden">
                <canvas ref={lfoCanvasRef} width={240} height={48} className="w-full h-full block" />
              </div>

              {/* LFO Shape selector */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">WAVE SHAPE:</span>
                <div className="flex items-center gap-1">
                  {(['sine', 'triangle', 'saw', 'square', 'noise'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateParams({ lfo1Shape: s })}
                      className={`px-1.5 py-0.5 rounded uppercase text-[9px] transition-colors ${
                        params.lfo1Shape === s
                          ? 'bg-pink-500/30 text-pink-300 border border-pink-500/50'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {s.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* LFO Rate */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>FREQUENCY RATE:</span>
                  <span className="text-pink-300 font-bold">{params.lfo1Rate.toFixed(2)} Hz</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="12"
                  step="0.05"
                  value={params.lfo1Rate}
                  onChange={(e) => onUpdateParams({ lfo1Rate: Number(e.target.value) })}
                  className="w-full accent-pink-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* LFO Depth */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>MODULATION DEPTH:</span>
                  <span className="text-slate-200 font-bold">{(params.lfo1Depth * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={params.lfo1Depth}
                  onChange={(e) => onUpdateParams({ lfo1Depth: Number(e.target.value) })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: 2D XY Modulation Pad */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('xyPad')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-emerald-300 text-[11px] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              2D XY MACRO PAD
            </span>
            {sections.xyPad ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {sections.xyPad && (
            <div className="p-2.5 flex flex-col gap-2">
              <div
                ref={xyPadRef}
                onMouseDown={handleXYMouseDown}
                onMouseMove={handleXYMouseMove}
                onMouseUp={handleXYMouseUp}
                onMouseLeave={handleXYMouseUp}
                className="relative w-full h-28 bg-[#05070d] border border-[#1a2538] rounded cursor-crosshair overflow-hidden"
              >
                {/* Crosshair lines */}
                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-800/80 pointer-events-none" />
                <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-800/80 pointer-events-none" />

                {/* Puck */}
                <div
                  style={{
                    left: `${((params.xyPadX + 1) / 2) * 100}%`,
                    top: `${((-params.xyPadY + 1) / 2) * 100}%`,
                  }}
                  className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-cyan-400 border border-white shadow-[0_0_10px_#00f0ff] pointer-events-none"
                />

                <div className="absolute top-1 left-2 pointer-events-none text-[8px] text-slate-600">
                  Y: FILTER CUTOFF
                </div>
                <div className="absolute bottom-1 right-2 pointer-events-none text-[8px] text-slate-600">
                  X: HAAS WIDTH
                </div>
              </div>

              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>X: {params.xyPadX.toFixed(2)}</span>
                <span>Y: {params.xyPadY.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: Visual Render Pipeline Inspector */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('visual')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-amber-300 text-[11px] flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              VISUAL RENDER PIPELINE
            </span>
            {sections.visual ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {sections.visual && (
            <div className="p-2.5 flex flex-col gap-2.5 text-[10px]">
              {/* Palette Switcher */}
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">COLOR PALETTE LUT:</span>
                <div className="grid grid-cols-2 gap-1 mt-0.5">
                  {palettes.map((p) => {
                    const isSelected = params.colorPalette === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => onUpdateParams({ colorPalette: p.id })}
                        className={`flex items-center gap-1.5 p-1 rounded border text-[9px] cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-slate-800 border-cyan-400 text-white'
                            : 'bg-[#06080e] border-[#151c2a] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="truncate">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bloom Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>BLOOM INTENSITY:</span>
                  <span className="text-amber-300 font-bold">{(params.bloom * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={params.bloom}
                  onChange={(e) => onUpdateParams({ bloom: Number(e.target.value) })}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Feedback Trails */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>FEEDBACK TRAILS:</span>
                  <span className="text-cyan-300 font-bold">{(params.feedbackTrails * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.96"
                  step="0.02"
                  value={params.feedbackTrails}
                  onChange={(e) => onUpdateParams({ feedbackTrails: Number(e.target.value) })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Reactivity Sensitivity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>AUDIO REACTIVITY GAIN:</span>
                  <span className="text-pink-300 font-bold">{params.reactivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.1"
                  value={params.reactivity}
                  onChange={(e) => onUpdateParams({ reactivity: Number(e.target.value) })}
                  className="w-full accent-pink-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* Chromatic Aberration */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>CHROMATIC DISPERSION:</span>
                  <span className="text-emerald-300 font-bold">{(params.chromaticAberration * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={params.chromaticAberration}
                  onChange={(e) => onUpdateParams({ chromaticAberration: Number(e.target.value) })}
                  className="w-full accent-emerald-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
