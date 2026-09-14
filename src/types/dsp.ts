export type VisualMode = 
  | 'raymarcher' 
  | 'cartography' 
  | 'particles' 
  | 'cymatics' 
  | 'cyberhud' 
  | 'tesseract';

export type ColorPalette = 
  | 'acid-neon' 
  | 'obsidian-cyan' 
  | 'solar-flare' 
  | 'infrared' 
  | 'matrix-emerald' 
  | 'spectral-void';

export interface AudioTelemetry {
  sub: number;       // 20-60 Hz (0..1)
  bass: number;      // 60-250 Hz (0..1)
  lowMid: number;    // 250-500 Hz (0..1)
  mid: number;       // 500-2000 Hz (0..1)
  highMid: number;   // 2000-6000 Hz (0..1)
  treble: number;    // 6000-20000 Hz (0..1)
  energy: number;    // overall energy (0..1)
  peakDb: number;    // dBFS (-90 to +3)
  rmsDb: number;     // RMS dBFS (-90 to 0)
  centroid: number;  // Spectral centroid in Hz (20 - 15000)
  flatness: number;  // Spectral flatness (0 - 1)
  isBeat: boolean;   // transient kick trigger
  beatCount: number; // cumulative beats
  phaseCorrelation: number; // -1 to +1
  bpm: number;
  dominantPitch: string;
}

export interface DspParameters {
  // Master
  masterVolume: number; // 0..1
  playbackRate: number; // 0.25..2.0
  loop: boolean;
  reverse: boolean;

  // Filter
  filterType: BiquadFilterType;
  filterCutoff: number; // 20..20000 Hz
  filterResonance: number; // 0..20
  filterDrive: number; // 0..10

  // Hallucinogenic DSP
  stereoWidth: number; // 0..2 (1 = normal)
  pitchShift: number; // -24..24 semitones
  bitcrushBits: number; // 1..16 bits
  bitcrushRate: number; // 0.05..1 (downsample factor)
  reverbWet: number; // 0..1
  reverbDecay: number; // 0.1..10s
  reverbDamp: number; // 0..1
  delayTime: number; // 0..1s
  delayFeedback: number; // 0..0.9
  delayWet: number; // 0..1
  granularStutter: number; // 0..1 (grain gate)
  tapeFlutter: number; // 0..1
  subHarmonic: number; // 0..1

  // Spectral Cartography
  contourDensity: number; // 5..50
  elevationScale: number; // 0.2..3.0
  spatiotemporalPersistence: number; // 0.1..0.98

  // Modulation Matrix
  lfo1Rate: number; // Hz (0.05..20)
  lfo1Shape: 'sine' | 'triangle' | 'square' | 'saw' | 'noise';
  lfo1Depth: number; // 0..1
  lfo2Rate: number;
  lfo2Shape: 'sine' | 'triangle' | 'square' | 'saw' | 'noise';
  lfo2Depth: number;

  envelopeAttack: number; // 0.01..1s
  envelopeRelease: number; // 0.05..3s
  envelopeSensitivity: number; // 0.1..5

  xyPadX: number; // -1..1
  xyPadY: number; // -1..1

  // Visual Pipeline
  bloom: number; // 0..1
  feedbackTrails: number; // 0..0.98
  chromaticAberration: number; // 0..1
  cameraFov: number; // 30..110
  particleCount: number; // 1000..20000
  glitchIntensity: number; // 0..1
  rotationSpeed: number; // -2..2
  reactivity: number; // 0.2..3.0
  wireframe: boolean;
  colorPalette: ColorPalette;
}

export interface PatchNode {
  id: string;
  type: 
    | 'audio-in' 
    | 'fft-splitter' 
    | 'spectral-filter' 
    | 'psy-raymarcher' 
    | 'particle-field' 
    | 'spatial-carto' 
    | 'lfo-matrix' 
    | 'envelope-follow' 
    | 'hallucination-dsp' 
    | 'reverb-space' 
    | 'cymatics-top' 
    | 'master-out';
  title: string;
  category: 'audio' | 'dsp' | 'visual' | 'mod' | 'out';
  x: number;
  y: number;
  inputs: { id: string; label: string; type: 'audio' | 'control' | 'texture' }[];
  outputs: { id: string; label: string; type: 'audio' | 'control' | 'texture' }[];
  params: Record<string, number | string | boolean>;
  collapsed?: boolean;
}

export interface PatchCable {
  id: string;
  fromNodeId: string;
  fromSocketId: string;
  toNodeId: string;
  toSocketId: string;
  color: string;
}

export interface AudioTrackMeta {
  id: string;
  title: string;
  artist: string;
  type: 'file' | 'synth' | 'archive' | 'mic';
  duration: number; // seconds
  bpm: number;
  key: string;
  sampleRate: number;
  description: string;
  speculativeRef?: string; // e.g. "ZIAA-P-0128"
}

export type WorkspaceLayout = 
  | 'default' 
  | 'patching' 
  | 'spectrogram' 
  | 'visualizer' 
  | 'dsp-console';
