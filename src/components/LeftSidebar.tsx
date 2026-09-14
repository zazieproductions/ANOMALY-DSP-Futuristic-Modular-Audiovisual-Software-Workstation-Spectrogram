import React, { useRef, useState } from 'react';
import { audioEngine } from '../lib/audioEngine';
import { BUILT_IN_TRACKS } from '../lib/presetData';
import { AudioTrackMeta, DspParameters, PatchNode, PatchCable } from '../types/dsp';
import { 
  UploadCloud, 
  FolderOpen, 
  Save, 
  Download, 
  Mic, 
  MicOff, 
  Cpu, 
  Sliders, 
  Layers, 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Zap,
  Music,
  FileAudio,
  Radio,
  Share2
} from 'lucide-react';

interface LeftSidebarProps {
  currentTrack: AudioTrackMeta;
  onSelectTrack: (track: AudioTrackMeta) => void;
  params: DspParameters;
  onUpdateParams: (newParams: Partial<DspParameters>) => void;
  nodes: PatchNode[];
  cables: PatchCable[];
  onLoadPatch: (patchData: { params: DspParameters; nodes: PatchNode[]; cables: PatchCable[] }) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentTrack,
  onSelectTrack,
  params,
  onUpdateParams,
  nodes,
  cables,
  onLoadPatch,
  isOpen,
  onToggleOpen,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const patchInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [tuningStandard, setTuningStandard] = useState<'432' | '440'>('432');
  const [bufferSize, setBufferSize] = useState<'128' | '256' | '512'>('256');

  // Collapsible section states
  const [openSections, setOpenSections] = useState({
    upload: true,
    library: true,
    routing: true,
    project: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Handle desktop audio file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const meta = await audioEngine.loadAudioFile(file);
      onSelectTrack(meta);
      setIsMicActive(false);
    } catch (err) {
      console.error('Audio file decode error:', err);
      alert('Unable to decode audio file. Please try a standard MP3, WAV, or OGG.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag & drop dropzone
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const meta = await audioEngine.loadAudioFile(file);
      onSelectTrack(meta);
      setIsMicActive(false);
    } catch (err) {
      console.error('Audio drop error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle Live Microphone
  const toggleMicrophone = async () => {
    if (isMicActive) {
      audioEngine.disableMicrophone();
      setIsMicActive(false);
      // Fallback to first preset
      const preset = BUILT_IN_TRACKS[0];
      audioEngine.setProceduralPreset(preset.id, preset);
      onSelectTrack(preset);
    } else {
      const ok = await audioEngine.enableMicrophone();
      if (ok) {
        setIsMicActive(true);
        onSelectTrack(audioEngine.getCurrentTrack());
      } else {
        alert('Microphone access denied or unavailable in this environment.');
      }
    }
  };

  // Save Patch JSON
  const handleSavePatch = () => {
    const patchData = {
      version: '3.8',
      name: `ziaa-patch-${Date.now()}`,
      timestamp: new Date().toISOString(),
      params,
      nodes,
      cables,
    };
    const blob = new Blob([JSON.stringify(patchData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ziaa_anomaly_patch_${Date.now().toString(36)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load Patch JSON
  const handleLoadPatch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.params && json.nodes && json.cables) {
          onLoadPatch(json);
        }
      } catch (err) {
        alert('Invalid patch JSON format.');
      }
    };
    reader.readAsText(file);
    if (patchInputRef.current) patchInputRef.current.value = '';
  };

  // Quick Modulation Cross-Routing Matrix state
  const [routingMatrix, setRoutingMatrix] = useState<Record<string, boolean>>({
    'lfo1-cutoff': true,
    'lfo2-warp': true,
    'env-reverb': false,
    'centroid-particles': true,
    'beat-raymarch': true,
  });

  const toggleRoute = (key: string) => {
    setRoutingMatrix((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Dynamic DSP load calculation
  const dspLoad = Math.min(98, Math.max(12, Math.round(18 + (params.particleCount / 20000) * 15 + params.bloom * 12 + (params.reverbWet * 8) + (Math.sin(Date.now() * 0.001) * 3))));

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className="w-8 bg-[#0c101a] border-r border-[#1a2333] flex flex-col items-center py-4 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer select-none"
        title="Open Project & Audio Inspector"
      >
        <ChevronRight className="w-4 h-4 mb-3" />
        <span className="text-[10px] font-mono [writing-mode:vertical-lr] tracking-widest uppercase">
          PROJECT & SOURCES
        </span>
      </button>
    );
  }

  return (
    <aside className="w-72 bg-[#090d15] border-r border-[#1a2333] flex flex-col h-full overflow-y-auto select-none font-mono text-xs text-slate-300 scrollbar-thin">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#0e1421] border-b border-[#1b2538]">
        <div className="flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 tracking-wider text-[11px]">
            PROJECT & MEDIA
          </span>
        </div>
        <button
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
          title="Collapse Sidebar"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col p-2.5 gap-3">
        {/* SECTION 1: Desktop Audio File Upload */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('upload')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-cyan-300 text-[11px] flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
              DESKTOP AUDIO UPLOAD
            </span>
            {openSections.upload ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {openSections.upload && (
            <div className="p-2.5 flex flex-col gap-2">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/70 bg-[#070a12] rounded p-3 text-center cursor-pointer transition-all group"
              >
                <UploadCloud className="w-6 h-6 mx-auto mb-1 text-cyan-400 group-hover:scale-110 transition-transform" />
                <div className="text-[11px] text-slate-200 font-semibold">
                  {isUploading ? 'DECODING AUDIO BUFFER...' : 'DROP AUDIO FILE HERE'}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  MP3, WAV, FLAC, OGG, M4A supported
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Active Loaded Source Specs */}
              <div className="bg-[#070a12] p-2 rounded border border-[#172030] text-[10px] flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">ACTIVE:</span>
                  <span className="text-cyan-300 truncate max-w-[130px] font-semibold">{currentTrack.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">TYPE:</span>
                  <span className="text-pink-300 uppercase">{currentTrack.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">FORMAT:</span>
                  <span className="text-slate-300">{currentTrack.sampleRate}Hz / Float32</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: ZIAA Speculative Listening Archive & Presets */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('library')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-emerald-300 text-[11px] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              ZIAA RESEARCH ARCHIVE
            </span>
            {openSections.library ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {openSections.library && (
            <div className="p-2 flex flex-col gap-1.5">
              {BUILT_IN_TRACKS.map((t) => {
                const isSelected = currentTrack.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      audioEngine.setProceduralPreset(t.id, t);
                      onSelectTrack(t);
                      setIsMicActive(false);
                    }}
                    className={`flex flex-col text-left p-2 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-slate-200'
                        : 'bg-[#070a12] border-[#151c2b] hover:border-slate-700 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] truncate">{t.title}</span>
                      {t.speculativeRef && (
                        <span className="text-[9px] text-emerald-400 font-mono px-1 rounded bg-emerald-950/60 border border-emerald-800/40">
                          {t.speculativeRef}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{t.description}</div>
                  </button>
                );
              })}

              {/* Live Microphone / Line-in Toggle */}
              <button
                onClick={toggleMicrophone}
                className={`flex items-center justify-between p-2 mt-1 rounded border transition-all cursor-pointer ${
                  isMicActive
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'bg-[#070a12] border-[#151c2b] hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isMicActive ? <Mic className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> : <MicOff className="w-3.5 h-3.5 text-slate-500" />}
                  <span className="font-semibold text-[11px]">
                    {isMicActive ? 'MIC STREAM ACTIVE' : 'ENABLE LIVE MICROPHONE'}
                  </span>
                </div>
                <span className="text-[9px]">{isMicActive ? 'LIVE' : 'OFF'}</span>
              </button>
            </div>
          )}
        </div>

        {/* SECTION 3: Control & Routing Matrix */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('routing')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-pink-300 text-[11px] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-pink-400" />
              MODULATION ROUTING MATRIX
            </span>
            {openSections.routing ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {openSections.routing && (
            <div className="p-2 flex flex-col gap-1.5 text-[10px]">
              <div className="text-[9px] text-slate-500 mb-1">
                SIGNAL BUS MATRIX ROUTING (CROSS-POINTS):
              </div>

              {[
                { key: 'lfo1-cutoff', src: 'LFO 1 [Sine]', dest: 'Filter Cutoff' },
                { key: 'lfo2-warp', src: 'LFO 2 [Tri]', dest: 'Haas / Pitch Warp' },
                { key: 'env-reverb', src: 'Envelope Follower', dest: 'Reverb Decay' },
                { key: 'centroid-particles', src: 'Spectral Centroid', dest: 'Particle Speed' },
                { key: 'beat-raymarch', src: 'Transient Kick', dest: 'Raymarch Deform' },
              ].map((route) => {
                const isActive = routingMatrix[route.key];
                return (
                  <div
                    key={route.key}
                    onClick={() => toggleRoute(route.key)}
                    className={`flex items-center justify-between p-1.5 rounded cursor-pointer border transition-colors ${
                      isActive
                        ? 'bg-pink-500/15 border-pink-500/40 text-pink-200'
                        : 'bg-[#070a12] border-[#151c2b] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{route.src} → {route.dest}</span>
                    <div className={`w-3 h-3 rounded flex items-center justify-center border ${isActive ? 'bg-pink-500 border-pink-400' : 'border-slate-700'}`}>
                      {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 4: Project Controls & DSP Engine Settings */}
        <div className="bg-[#0b0f19] border border-[#1b2436] rounded overflow-hidden">
          <div
            onClick={() => toggleSection('project')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[#121826] cursor-pointer hover:bg-[#161f30] transition-colors"
          >
            <span className="font-semibold text-amber-300 text-[11px] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              DSP SYSTEM & PATCH
            </span>
            {openSections.project ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {openSections.project && (
            <div className="p-2.5 flex flex-col gap-2.5 text-[10px]">
              {/* DSP Load meter */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span>DSP LOAD:</span>
                  <span className="text-amber-300 font-bold">{dspLoad}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${dspLoad > 85 ? 'bg-rose-500' : dspLoad > 60 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                    style={{ width: `${dspLoad}%` }}
                  />
                </div>
              </div>

              {/* Master Tuning Reference */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">TUNING REF:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTuningStandard('432')}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      tuningStandard === '432' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    432Hz
                  </button>
                  <button
                    onClick={() => setTuningStandard('440')}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      tuningStandard === '440' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    440Hz
                  </button>
                </div>
              </div>

              {/* Audio Buffer Size */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">LATENCY BUFFER:</span>
                <div className="flex items-center gap-1">
                  {(['128', '256', '512'] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBufferSize(b)}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        bufferSize === b ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save & Load Patch Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleSavePatch}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition-colors cursor-pointer"
                >
                  <Save className="w-3 h-3 text-cyan-400" />
                  <span>EXPORT .JSON</span>
                </button>

                <button
                  onClick={() => patchInputRef.current?.click()}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3 text-emerald-400" />
                  <span>LOAD .JSON</span>
                </button>
                <input
                  ref={patchInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleLoadPatch}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
