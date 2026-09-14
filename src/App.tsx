import React, { useState, useEffect, useCallback } from 'react';
import { audioEngine } from './lib/audioEngine';
import { 
  BUILT_IN_TRACKS, 
  DEFAULT_DSP_PARAMS, 
  INITIAL_PATCH_NODES, 
  INITIAL_PATCH_CABLES 
} from './lib/presetData';
import { 
  DspParameters, 
  AudioTelemetry, 
  AudioTrackMeta, 
  WorkspaceLayout, 
  PatchNode, 
  PatchCable 
} from './types/dsp';

import { TopNavbar } from './components/TopNavbar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightInspector } from './components/RightInspector';
import { VisualizationCanvas } from './components/VisualizationCanvas';
import { WaveformTimeline } from './components/WaveformTimeline';
import { SpectrogramAnalyzer } from './components/SpectrogramAnalyzer';
import { NodePatchingWindow } from './components/NodePatchingWindow';
import { HelpModal } from './components/HelpModal';

export function App() {
  // App state
  const [params, setParams] = useState<DspParameters>(DEFAULT_DSP_PARAMS);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrackMeta>(BUILT_IN_TRACKS[0]);
  const [layout, setLayout] = useState<WorkspaceLayout>('default');

  // Sidebar visibility
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);
  const [bottomPanelTab, setBottomPanelTab] = useState<'both' | 'waveform' | 'spectrogram'>('both');

  // Node patcher state
  const [isNodeWindowOpen, setIsNodeWindowOpen] = useState(true);
  const [nodes, setNodes] = useState<PatchNode[]>(INITIAL_PATCH_NODES);
  const [cables, setCables] = useState<PatchCable[]>(INITIAL_PATCH_CABLES);

  // Help modal
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Telemetry state polled at ~60fps
  const [telemetry, setTelemetry] = useState<AudioTelemetry>({
    sub: 0.1,
    bass: 0.1,
    lowMid: 0.1,
    mid: 0.1,
    highMid: 0.1,
    treble: 0.1,
    energy: 0.1,
    peakDb: -60,
    rmsDb: -60,
    centroid: 440,
    flatness: 0.1,
    isBeat: false,
    beatCount: 0,
    phaseCorrelation: 0.9,
    bpm: 124,
    dominantPitch: 'D# Minor',
  });

  // Parameter update handler
  const handleUpdateParams = useCallback((newParams: Partial<DspParameters>) => {
    setParams((prev) => {
      const merged = { ...prev, ...newParams };
      audioEngine.updateParams(newParams);
      return merged;
    });
  }, []);

  // Telemetry polling loop
  useEffect(() => {
    let animId: number;
    const poll = () => {
      const t = audioEngine.getTelemetry();
      setTelemetry(t);
      setIsPlaying(audioEngine.getIsPlaying());
      animId = requestAnimationFrame(poll);
    };
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsNodeWindowOpen((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Play/Pause transport
  const togglePlay = () => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioEngine.stop();
    setIsPlaying(false);
  };

  // Switch Track
  const handleSelectTrack = (track: AudioTrackMeta) => {
    setCurrentTrack(track);
    // If was playing, keep playing
    if (isPlaying) {
      audioEngine.play();
    }
  };

  // Switch Layout presets
  const handleSelectLayout = (newLayout: WorkspaceLayout) => {
    setLayout(newLayout);
    switch (newLayout) {
      case 'patching':
        setLeftSidebarOpen(false);
        setRightInspectorOpen(false);
        setIsNodeWindowOpen(true);
        break;
      case 'visualizer':
        setLeftSidebarOpen(false);
        setRightInspectorOpen(false);
        setIsNodeWindowOpen(false);
        break;
      case 'spectrogram':
        setLeftSidebarOpen(true);
        setRightInspectorOpen(false);
        setBottomPanelTab('spectrogram');
        break;
      case 'dsp-console':
        setLeftSidebarOpen(false);
        setRightInspectorOpen(true);
        break;
      case 'default':
      default:
        setLeftSidebarOpen(true);
        setRightInspectorOpen(true);
        setIsNodeWindowOpen(true);
        setBottomPanelTab('both');
        break;
    }
  };

  // Load custom patch
  const handleLoadPatch = (patchData: { params: DspParameters; nodes: PatchNode[]; cables: PatchCable[] }) => {
    setParams(patchData.params);
    setNodes(patchData.nodes);
    setCables(patchData.cables);
    audioEngine.updateParams(patchData.params);
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-[#06080e] text-slate-200 overflow-hidden font-sans">
      {/* 1. Global Master Top Navigation */}
      <TopNavbar
        layout={layout}
        onSelectLayout={handleSelectLayout}
        isNodeWindowOpen={isNodeWindowOpen}
        onToggleNodeWindow={() => setIsNodeWindowOpen(!isNodeWindowOpen)}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        params={params}
        onUpdateParams={handleUpdateParams}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* 2. Main Workspace Body (3-Panel Grid with floating nodes) */}
      <div className="relative flex flex-1 w-full min-h-0 overflow-hidden">
        {/* Left Sidebar: Audio Upload, Library, Routing, Project Controls */}
        <LeftSidebar
          currentTrack={currentTrack}
          onSelectTrack={handleSelectTrack}
          params={params}
          onUpdateParams={handleUpdateParams}
          nodes={nodes}
          cables={cables}
          onLoadPatch={handleLoadPatch}
          isOpen={leftSidebarOpen}
          onToggleOpen={() => setLeftSidebarOpen(!leftSidebarOpen)}
        />

        {/* Center Main Viewport: Canvas & Floating Node Patcher */}
        <div className="relative flex-1 flex flex-col min-w-0 h-full bg-[#04060a] overflow-hidden">
          <VisualizationCanvas
            params={params}
            onUpdateParams={handleUpdateParams}
            telemetry={telemetry}
          />

          {/* Floating Max/MSP & TouchDesigner Modular Node Patching Window */}
          <NodePatchingWindow
            nodes={nodes}
            cables={cables}
            onUpdateNodes={setNodes}
            onUpdateCables={setCables}
            onUpdateDspParams={handleUpdateParams}
            dspParams={params}
            telemetry={telemetry}
            isOpen={isNodeWindowOpen}
            onClose={() => setIsNodeWindowOpen(false)}
          />
        </div>

        {/* Right Inspector: Effects, Modulation, Filter Bank, Visual LUTs */}
        <RightInspector
          params={params}
          onUpdateParams={handleUpdateParams}
          telemetry={telemetry}
          isOpen={rightInspectorOpen}
          onToggleOpen={() => setRightInspectorOpen(!rightInspectorOpen)}
        />
      </div>

      {/* 3. Bottom Docked Panels: Waveform Timeline & Spectrogram Analyzer */}
      <div className="flex flex-col bg-[#070a12] border-t border-[#182335] shrink-0">
        {/* Bottom Panel Navigation / Tab bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-[#0a0f1c] border-b border-[#162030] text-[10px] font-mono text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold tracking-wider">ANALYSIS & TIMELINE DOCK</span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setBottomPanelTab('both')}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                bottomPanelTab === 'both' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'hover:text-slate-200'
              }`}
            >
              COMBINED VIEW
            </button>
            <button
              onClick={() => setBottomPanelTab('waveform')}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                bottomPanelTab === 'waveform' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'hover:text-slate-200'
              }`}
            >
              WAVEFORM ONLY
            </button>
            <button
              onClick={() => setBottomPanelTab('spectrogram')}
              className={`px-2 py-0.5 rounded cursor-pointer ${
                bottomPanelTab === 'spectrogram' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'hover:text-slate-200'
              }`}
            >
              SPECTROGRAM ONLY
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500">HOTKEYS:</span>
            <span><kbd className="text-cyan-400">SPACE</kbd> PLAY</span>
            <span><kbd className="text-pink-400">P</kbd> PATCHER</span>
            <span><kbd className="text-amber-400">?</kbd> GUIDE</span>
          </div>
        </div>

        {/* Waveform Timeline */}
        {(bottomPanelTab === 'both' || bottomPanelTab === 'waveform') && (
          <WaveformTimeline
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onStop={handleStop}
            track={currentTrack}
            params={params}
            onUpdateParams={handleUpdateParams}
            telemetry={telemetry}
          />
        )}

        {/* Spectrogram & 32-Band FFT Analyzer */}
        {(bottomPanelTab === 'both' || bottomPanelTab === 'spectrogram') && (
          <SpectrogramAnalyzer telemetry={telemetry} />
        )}
      </div>

      {/* 4. Architecture Guide Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}

export default App;
