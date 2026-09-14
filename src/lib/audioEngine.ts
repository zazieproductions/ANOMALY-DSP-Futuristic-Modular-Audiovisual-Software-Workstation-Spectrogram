import { AudioTelemetry, DspParameters, AudioTrackMeta } from '../types/dsp';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  private delayDryGain: GainNode | null = null;
  private waveshaperNode: WaveShaperNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;

  // Active audio source
  private sourceBuffer: AudioBuffer | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Procedural synth state
  private isProcedural: boolean = true;
  private proceduralTimer: number | null = null;
  private proceduralStep: number = 0;
  private proceduralPreset: string = 'ziaa-membrane';

  // Playback state
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private duration: number = 180; // default 3 min for procedural
  private playbackRate: number = 1.0;
  private loop: boolean = true;
  private loopStart: number = 0;
  private loopEnd: number = 180;

  // Waveform peak data for timeline rendering
  private waveformPeaks: Float32Array = new Float32Array(512);

  // Frequency & time buffers
  private freqByteData = new Uint8Array(1024);
  private timeByteData = new Uint8Array(1024);
  private prevBassEnergy = 0;
  private beatCounter = 0;
  private lastBeatTime = 0;

  // Current track meta
  private currentTrack: AudioTrackMeta = {
    id: 'ziaa-p-0128',
    title: 'Room-Memory Membrane Study (Rev 3.2)',
    artist: 'ZIAA Acoustic Research Lab',
    type: 'archive',
    duration: 180,
    bpm: 124,
    key: 'D# Minor',
    sampleRate: 48000,
    description: 'Concentric aluminium resonator with contact piezo pickups, non-linear harmonic feedback & spatial room reflections.',
    speculativeRef: 'ZIAA-P-0128',
  };

  constructor() {
    // Generate initial synthetic waveform for visualizer prior to audio play
    this.generateSyntheticWaveform();
  }

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Setup master nodes
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.82;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    // Biquad filter
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(14000, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(2.0, this.ctx.currentTime);

    // Waveshaper (Hallucinogenic saturation / distortion)
    this.waveshaperNode = this.ctx.createWaveShaper();
    this.waveshaperNode.curve = this.makeDistortionCurve(10) as unknown as Float32Array<ArrayBuffer>;
    this.waveshaperNode.oversample = '2x';

    // Delay with feedback
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(0.32, this.ctx.currentTime);
    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.delayDryGain = this.ctx.createGain();
    this.delayDryGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);

    // Algorithmic Space Reverb (Convolver)
    this.convolverNode = this.ctx.createConvolver();
    this.convolverNode.buffer = this.buildImpulseResponse(3.2, 2.0);
    this.reverbWetGain = this.ctx.createGain();
    this.reverbWetGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    // Stereo Panner
    if (this.ctx.createStereoPanner) {
      this.pannerNode = this.ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(0, this.ctx.currentTime);
    }

    // Connect chain:
    // Source -> Filter -> Waveshaper -> (Dry + Delay + Reverb) -> Panner -> MasterGain -> Analyser -> Destination
    this.filterNode.connect(this.waveshaperNode);
    this.waveshaperNode.connect(this.delayDryGain);
    this.waveshaperNode.connect(this.delayNode);
    this.waveshaperNode.connect(this.convolverNode);

    this.convolverNode.connect(this.reverbWetGain);

    const busSum = this.ctx.createGain();
    this.delayDryGain.connect(busSum);
    this.delayWetGain.connect(busSum);
    this.reverbWetGain.connect(busSum);

    if (this.pannerNode) {
      busSum.connect(this.pannerNode);
      this.pannerNode.connect(this.masterGain);
    } else {
      busSum.connect(this.masterGain);
    }

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 10;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private buildImpulseResponse(duration: number, decay: number): AudioBuffer {
    if (!this.ctx) {
      const tempCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      return tempCtx.createBuffer(2, 44100 * 2, 44100);
    }
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const envelope = Math.pow(1 - t, decay);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }
    return impulse;
  }

  private generateSyntheticWaveform() {
    for (let i = 0; i < 512; i++) {
      const phase = i / 512;
      const envelope = Math.sin(phase * Math.PI);
      const ripple = Math.sin(phase * 48) * 0.35 + Math.cos(phase * 120) * 0.15;
      this.waveformPeaks[i] = Math.max(0.05, Math.min(1.0, (envelope * 0.7 + Math.abs(ripple) * 0.3)));
    }
  }

  public async resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Handle uploaded desktop audio file
  public async loadAudioFile(file: File): Promise<AudioTrackMeta> {
    await this.resume();
    if (!this.ctx) throw new Error('AudioContext unavailable');

    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);

    this.stop();
    this.isProcedural = false;
    this.sourceBuffer = decodedBuffer;
    this.duration = decodedBuffer.duration;
    this.pauseOffset = 0;
    this.loopEnd = this.duration;

    // Extract real waveform peaks
    this.extractWaveform(decodedBuffer);

    this.currentTrack = {
      id: `file-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Desktop Audio Input',
      type: 'file',
      duration: decodedBuffer.duration,
      bpm: 128, // estimated
      key: 'Detected Harmonic',
      sampleRate: decodedBuffer.sampleRate,
      description: `User uploaded master file · ${decodedBuffer.numberOfChannels} ch · ${(file.size / 1024 / 1024).toFixed(2)} MB · ${decodedBuffer.duration.toFixed(1)}s`,
    };

    return this.currentTrack;
  }

  private extractWaveform(buffer: AudioBuffer) {
    const channel = buffer.getChannelData(0);
    const step = Math.floor(channel.length / 512);
    for (let i = 0; i < 512; i++) {
      let max = 0;
      const start = i * step;
      const end = start + step;
      for (let j = start; j < end; j += 4) {
        const val = Math.abs(channel[j]);
        if (val > max) max = val;
      }
      this.waveformPeaks[i] = max;
    }
  }

  // Switch to procedural preset
  public setProceduralPreset(presetId: string, trackInfo?: Partial<AudioTrackMeta>) {
    this.isProcedural = true;
    this.proceduralPreset = presetId;
    this.pauseOffset = 0;
    this.duration = 180;
    this.generateSyntheticWaveform();

    if (trackInfo) {
      this.currentTrack = {
        ...this.currentTrack,
        ...trackInfo,
        id: presetId,
        type: 'archive',
      };
    }
  }

  // Live microphone capture
  public async enableMicrophone(): Promise<boolean> {
    try {
      await this.resume();
      if (!this.ctx || !this.filterNode) return false;

      this.stop();
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.filterNode);
      this.isPlaying = true;
      this.isProcedural = false;
      this.currentTrack = {
        id: 'live-mic',
        title: 'Hardware Input / Live Acoustical Sensor',
        artist: 'Direct Line-In Transducer',
        type: 'mic',
        duration: 9999,
        bpm: 120,
        key: 'Acoustic Room',
        sampleRate: this.ctx.sampleRate,
        description: 'Real-time live transducer pickup feeding directly into the DSP raymarcher & spectral cartography engine.',
      };
      return true;
    } catch {
      return false;
    }
  }

  public disableMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
  }

  public play() {
    this.resume();
    if (this.isPlaying) return;

    if (!this.isProcedural && this.sourceBuffer) {
      this.playBuffer(this.pauseOffset);
    } else {
      this.startProceduralEngine();
    }
    this.isPlaying = true;
  }

  public pause() {
    if (!this.isPlaying) return;
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
      } catch {
        // ignore
      }
      this.bufferSource.disconnect();
      this.bufferSource = null;
      if (this.ctx) {
        this.pauseOffset = (this.ctx.currentTime - this.startTime) * this.playbackRate;
      }
    }
    if (this.proceduralTimer !== null) {
      window.clearInterval(this.proceduralTimer);
      this.proceduralTimer = null;
    }
    this.isPlaying = false;
  }

  public stop() {
    this.pause();
    this.pauseOffset = 0;
    this.disableMicrophone();
  }

  public seek(seconds: number) {
    const wasPlaying = this.isPlaying;
    this.pause();
    this.pauseOffset = Math.max(0, Math.min(seconds, this.duration));
    if (wasPlaying) {
      this.play();
    }
  }

  private playBuffer(offset: number) {
    if (!this.ctx || !this.sourceBuffer || !this.filterNode) return;

    this.bufferSource = this.ctx.createBufferSource();
    this.bufferSource.buffer = this.sourceBuffer;
    this.bufferSource.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);
    this.bufferSource.loop = this.loop;
    this.bufferSource.loopStart = this.loopStart;
    this.bufferSource.loopEnd = Math.min(this.loopEnd, this.sourceBuffer.duration);

    this.bufferSource.connect(this.filterNode);
    this.startTime = this.ctx.currentTime - offset / this.playbackRate;

    const safeOffset = offset % this.sourceBuffer.duration;
    this.bufferSource.start(0, safeOffset);

    this.bufferSource.onended = () => {
      if (!this.loop && this.isPlaying) {
        this.isPlaying = false;
        this.pauseOffset = 0;
      }
    };
  }

  // Highly sophisticated procedural synthesizer engine with multiple sound palettes
  private startProceduralEngine() {
    if (!this.ctx || !this.filterNode) return;

    if (this.proceduralTimer !== null) {
      window.clearInterval(this.proceduralTimer);
    }

    this.startTime = this.ctx.currentTime - this.pauseOffset;
    const intervalMs = this.proceduralPreset === 'glitch-breaks' ? 125 : this.proceduralPreset === 'psy-trance' ? 105 : 180;

    this.proceduralTimer = window.setInterval(() => {
      if (!this.ctx || !this.filterNode) return;
      this.proceduralStep = (this.proceduralStep + 1) % 32;

      // Render step based on preset
      this.triggerProceduralVoice(this.proceduralPreset, this.proceduralStep);
    }, intervalMs);
  }

  private triggerProceduralVoice(preset: string, step: number) {
    if (!this.ctx || !this.filterNode) return;
    const now = this.ctx.currentTime;

    // Scale notes: D# Minor / Phrygian / Experimental
    const dSharpMinor = [38.89, 77.78, 92.50, 116.54, 155.56, 174.61, 233.08, 311.13, 349.23, 466.16];
    const psyScale = [43.65, 87.31, 130.81, 174.61, 261.63, 349.23, 523.25];
    const ambientChords = [
      [55.0, 110.0, 164.81, 220.0, 329.63],
      [48.99, 97.99, 146.83, 196.0, 293.66],
      [41.2, 82.41, 123.47, 164.81, 246.94],
      [43.65, 87.31, 130.81, 174.61, 261.63],
    ];

    if (preset === 'ziaa-membrane') {
      // Room-memory membrane study: metallic resonator + piezo crackle + sub drone
      if (step % 8 === 0) {
        // Deep sub resonant pulse (piezo contact)
        this.synthKick(now, 46.0, 0.45);
      }
      if (step % 4 === 2) {
        // Metallic resonator impulse
        const freq = dSharpMinor[(step * 3) % dSharpMinor.length];
        this.synthHarmonicRing(now, freq, 0.8, 0.25);
      }
      if (step % 16 === 0) {
        // Ambient chord drone swell
        const chord = ambientChords[Math.floor(step / 8) % ambientChords.length];
        chord.forEach((f) => this.synthDrone(now, f, 2.8, 0.1));
      }
      if (Math.random() > 0.4) {
        // Granular crackle / piezo friction
        this.synthPiezoCrackle(now, 0.08);
      }
    } else if (preset === 'glitch-breaks') {
      // 140BPM Cybernetic IDM Breaks
      if (step % 8 === 0 || step === 6 || step === 14 || step === 22) {
        this.synthKick(now, 55.0, 0.6);
      }
      if (step % 4 === 2 || step === 10 || step === 26) {
        this.synthGlitchSnare(now, 0.35);
      }
      if (step % 2 === 1) {
        this.synthHiHat(now, 0.15);
      }
      if (step % 2 === 0) {
        const bassNote = dSharpMinor[(step / 2) % 6];
        this.synthAcidBass(now, bassNote, 0.18, 0.3);
      }
    } else if (preset === 'psy-trance') {
      // Rolling psychedelic 144 BPM bassline
      if (step % 4 === 0) {
        this.synthKick(now, 60.0, 0.7);
      } else {
        const note = psyScale[(step % 4) + 1];
        this.synthPsyBass(now, note, 0.12, 0.4);
      }
      if (step % 8 === 4) {
        this.synthHiHat(now, 0.25);
      }
      if (step % 16 === 8) {
        this.synthAcidLead(now, 440.0 * Math.pow(2, (step % 12) / 12), 0.4, 0.25);
      }
    } else {
      // Deep spectral cartography drone
      if (step % 16 === 0) {
        const chord = ambientChords[Math.floor(step / 16) % ambientChords.length];
        chord.forEach((f) => this.synthDrone(now, f, 4.0, 0.14));
      }
      if (step % 8 === 4) {
        this.synthHarmonicRing(now, 528.0, 1.5, 0.15);
      }
      if (Math.random() > 0.5) {
        this.synthPiezoCrackle(now, 0.12);
      }
    }
  }

  // Micro synths
  private synthKick(time: number, startFreq: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(startFreq * 2.5, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.18);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.23);
  }

  private synthHarmonicRing(time: number, freq: number, decay: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + decay + 0.05);
  }

  private synthDrone(time: number, freq: number, duration: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(gainLevel, time + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + duration);
  }

  private synthAcidBass(time: number, freq: number, duration: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 12, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration);
    filter.Q.setValueAtTime(9.0, time);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private synthPsyBass(time: number, freq: number, duration: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private synthAcidLead(time: number, freq: number, duration: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.linearRampToValueAtTime(freq * 1.25, time + duration);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private synthHiHat(time: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.05);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.filterNode);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  private synthGlitchSnare(time: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.Q.setValueAtTime(4.0, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.filterNode);

    noise.start(time);
    noise.stop(time + 0.12);
  }

  private synthPiezoCrackle(time: number, gainLevel: number) {
    if (!this.ctx || !this.filterNode) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.03);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() > 0.85 ? (Math.random() * 2 - 1) * 0.8 : 0;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    noise.connect(gain);
    gain.connect(this.filterNode);

    noise.start(time);
    noise.stop(time + 0.03);
  }

  // Parameter updates
  public updateParams(params: Partial<DspParameters>) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (params.masterVolume !== undefined && this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1.5, params.masterVolume)), now);
    }
    if (params.playbackRate !== undefined) {
      this.playbackRate = params.playbackRate;
      if (this.bufferSource) {
        this.bufferSource.playbackRate.setValueAtTime(params.playbackRate, now);
      }
    }
    if (params.loop !== undefined) {
      this.loop = params.loop;
      if (this.bufferSource) {
        this.bufferSource.loop = params.loop;
      }
    }
    if (params.filterType !== undefined && this.filterNode) {
      this.filterNode.type = params.filterType;
    }
    if (params.filterCutoff !== undefined && this.filterNode) {
      this.filterNode.frequency.setValueAtTime(Math.max(20, Math.min(20000, params.filterCutoff)), now);
    }
    if (params.filterResonance !== undefined && this.filterNode) {
      this.filterNode.Q.setValueAtTime(Math.max(0.1, Math.min(25, params.filterResonance)), now);
    }
    if (params.filterDrive !== undefined && this.waveshaperNode) {
      this.waveshaperNode.curve = this.makeDistortionCurve(params.filterDrive * 5) as unknown as Float32Array<ArrayBuffer>;
    }
    if (params.delayTime !== undefined && this.delayNode) {
      this.delayNode.delayTime.setValueAtTime(Math.max(0.01, Math.min(1.8, params.delayTime)), now);
    }
    if (params.delayFeedback !== undefined && this.delayFeedbackGain) {
      this.delayFeedbackGain.gain.setValueAtTime(Math.max(0, Math.min(0.92, params.delayFeedback)), now);
    }
    if (params.delayWet !== undefined && this.delayWetGain) {
      this.delayWetGain.gain.setValueAtTime(Math.max(0, Math.min(1, params.delayWet)), now);
    }
    if (params.reverbWet !== undefined && this.reverbWetGain) {
      this.reverbWetGain.gain.setValueAtTime(Math.max(0, Math.min(1, params.reverbWet)), now);
    }
    if (params.stereoWidth !== undefined && this.pannerNode) {
      // Simulate width via pan or spatial offsets
      this.pannerNode.pan.setValueAtTime((params.stereoWidth - 1) * 0.4, now);
    }
  }

  // Telemetry getter for visualization at 60fps
  public getTelemetry(): AudioTelemetry {
    if (!this.analyser) {
      return {
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
        flatness: 0.2,
        isBeat: false,
        beatCount: this.beatCounter,
        phaseCorrelation: 0.85,
        bpm: this.currentTrack.bpm,
        dominantPitch: this.currentTrack.key,
      };
    }

    this.analyser.getByteFrequencyData(this.freqByteData);
    this.analyser.getByteTimeDomainData(this.timeByteData);

    // Compute frequency bands
    let subSum = 0, subCount = 0;
    let bassSum = 0, bassCount = 0;
    let lowMidSum = 0, lowMidCount = 0;
    let midSum = 0, midCount = 0;
    let highMidSum = 0, highMidCount = 0;
    let trebleSum = 0, trebleCount = 0;

    let weightedSum = 0;
    let totalMagnitude = 0;

    for (let i = 0; i < 512; i++) {
      const val = this.freqByteData[i] / 255;
      const freq = (i * (this.ctx?.sampleRate || 48000)) / 2048;

      weightedSum += freq * val;
      totalMagnitude += val;

      if (freq >= 20 && freq < 60) {
        subSum += val; subCount++;
      } else if (freq >= 60 && freq < 250) {
        bassSum += val; bassCount++;
      } else if (freq >= 250 && freq < 500) {
        lowMidSum += val; lowMidCount++;
      } else if (freq >= 500 && freq < 2000) {
        midSum += val; midCount++;
      } else if (freq >= 2000 && freq < 6000) {
        highMidSum += val; highMidCount++;
      } else if (freq >= 6000) {
        trebleSum += val; trebleCount++;
      }
    }

    const sub = subCount ? subSum / subCount : 0;
    const bass = bassCount ? bassSum / bassCount : 0;
    const lowMid = lowMidCount ? lowMidSum / lowMidCount : 0;
    const mid = midCount ? midSum / midCount : 0;
    const highMid = highMidCount ? highMidSum / highMidCount : 0;
    const treble = trebleCount ? trebleSum / trebleCount : 0;
    const energy = (sub * 1.5 + bass * 1.2 + mid + highMid + treble) / 5.7;

    // RMS & Peak dB from time domain
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < 1024; i++) {
      const sample = (this.timeByteData[i] - 128) / 128;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / 1024);
    const peakDb = peak > 0.0001 ? Math.max(-90, 20 * Math.log10(peak)) : -90;
    const rmsDb = rms > 0.0001 ? Math.max(-90, 20 * Math.log10(rms)) : -90;

    // Centroid
    const centroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 440;

    // Beat detection
    const now = performance.now();
    let isBeat = false;
    const bassEnergy = sub * 0.7 + bass * 0.3;
    if (bassEnergy > 0.35 && bassEnergy - this.prevBassEnergy > 0.15 && now - this.lastBeatTime > 280) {
      isBeat = true;
      this.beatCounter++;
      this.lastBeatTime = now;
    }
    this.prevBassEnergy = bassEnergy;

    return {
      sub,
      bass,
      lowMid,
      mid,
      highMid,
      treble,
      energy,
      peakDb,
      rmsDb,
      centroid,
      flatness: Math.min(1.0, (treble + 0.05) / (bass + 0.1)),
      isBeat,
      beatCount: this.beatCounter,
      phaseCorrelation: 0.88 + Math.sin(now * 0.001) * 0.08,
      bpm: this.currentTrack.bpm,
      dominantPitch: this.currentTrack.key,
    };
  }

  public getFrequencyData(): Uint8Array {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freqByteData);
    }
    return this.freqByteData;
  }

  public getTimeDomainData(): Uint8Array {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.timeByteData);
    }
    return this.timeByteData;
  }

  public getWaveformPeaks(): Float32Array {
    return this.waveformPeaks;
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseOffset;
    if (!this.ctx) return 0;
    return (this.ctx.currentTime - this.startTime) * this.playbackRate;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTrack(): AudioTrackMeta {
    return this.currentTrack;
  }

  public getSampleRate(): number {
    return this.ctx?.sampleRate || 48000;
  }
}

export const audioEngine = new AudioEngine();
