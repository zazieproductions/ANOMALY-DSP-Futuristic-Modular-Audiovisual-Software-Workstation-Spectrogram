import React from 'react';
import { WorkspaceLayout, DspParameters } from '../types/dsp';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Layout, 
  Cpu, 
  Zap, 
  Share2, 
  HelpCircle, 
  Sliders, 
  Radio, 
  Maximize2,
  Activity,
  Layers
} from 'lucide-react';

interface TopNavbarProps {
  layout: WorkspaceLayout;
  onSelectLayout: (layout: WorkspaceLayout) => void;
  isNodeWindowOpen: boolean;
  onToggleNodeWindow: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  params: DspParameters;
  onUpdateParams: (newParams: Partial<DspParameters>) => void;
  onOpenHelp: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  layout,
  onSelectLayout,
  isNodeWindowOpen,
  onToggleNodeWindow,
  isPlaying,
  onTogglePlay,
  params,
  onUpdateParams,
  onOpenHelp,
}) => {
  return (
    <header className="h-12 bg-[#080b12] border-b border-[#1b2538] flex items-center justify-between px-3 font-mono text-xs text-slate-300 select-none z-40">
      {/* Left: Branding & Institute Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Logo Glyph */}
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center p-0.5 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
            <div className="w-full h-full bg-[#080c14] rounded-sm flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-bold text-white tracking-wider text-[12px]">ZIAA // ANOMALY-DSP</span>
              <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">v3.8</span>
            </div>
            <span className="text-[9px] text-slate-400 leading-none truncate max-w-[220px]">
              MODULAR AUDIOVISUAL WORKSPACE
            </span>
          </div>
        </div>

        {/* Global Node Patching Window Launcher Button */}
        <button
          onClick={onToggleNodeWindow}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer border ${
            isNodeWindowOpen
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>MAX / TD PATCHER</span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        </button>
      </div>

      {/* Center: Layout Presets */}
      <div className="hidden lg:flex items-center gap-1 bg-[#05070c] border border-[#182335] rounded p-0.5 text-[11px]">
        {(
          [
            { id: 'default', label: 'Default DAW' },
            { id: 'patching', label: 'Modular Graph' },
            { id: 'spectrogram', label: 'Spectral Lab' },
            { id: 'visualizer', label: 'Full Visualizer' },
            { id: 'dsp-console', label: 'DSP Focus' },
          ] as const
        ).map((l) => (
          <button
            key={l.id}
            onClick={() => onSelectLayout(l.id)}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              layout === l.id
                ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Right: Master Audio Status & Telemetry */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Quick Toggle */}
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
              : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
          }`}
        >
          {isPlaying ? <Pause className="w-3 h-3 fill-black" /> : <Play className="w-3 h-3 fill-black" />}
          <span>{isPlaying ? 'RUN' : 'PLAY'}</span>
        </button>

        {/* Master Gain Slider */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#0d131f] border border-[#1f2c42] rounded px-2 py-1">
          {params.masterVolume === 0 ? (
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <input
            type="range"
            min="0"
            max="1.2"
            step="0.02"
            value={params.masterVolume}
            onChange={(e) => onUpdateParams({ masterVolume: Number(e.target.value) })}
            className="w-16 accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
            title="Master Gain"
          />
        </div>

        {/* Engine Telemetry Readout */}
        <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-400 bg-[#0d131f] border border-[#1f2c42] px-2 py-1 rounded">
          <span className="text-emerald-400 font-bold">48 kHz</span>
          <span className="text-slate-600">|</span>
          <span>LATENCY: <b className="text-slate-300">2.1ms</b></span>
          <span className="text-slate-600">|</span>
          <span>LIMITER: <b className="text-cyan-400">ON</b></span>
        </div>

        {/* Help / Docs Modal Button */}
        <button
          onClick={onOpenHelp}
          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors cursor-pointer"
          title="About & Architecture Guide"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
