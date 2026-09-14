import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from '../lib/audioEngine';
import { VisualMode, ColorPalette, DspParameters, AudioTelemetry } from '../types/dsp';
import { 
  Maximize2, 
  Minimize2, 
  Camera, 
  Compass, 
  Layers, 
  Eye, 
  Activity, 
  Sparkles, 
  Grid3X3,
  Waves,
  Zap,
  Box
} from 'lucide-react';

interface VisualizerCanvasProps {
  params: DspParameters;
  onUpdateParams: (newParams: Partial<DspParameters>) => void;
  telemetry: AudioTelemetry;
}

export const VisualizationCanvas: React.FC<VisualizerCanvasProps> = ({
  params,
  onUpdateParams,
  telemetry,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlayTelemetry, setShowOverlayTelemetry] = useState(true);

  // Camera rotation & zoom state
  const rotX = useRef(0.35);
  const rotY = useRef(0.0);
  const zoom = useRef(1.0);
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);

  // Historical waterfall buffer for spectral cartography
  const historyRef = useRef<Float32Array[]>([]);
  // Particle system buffer
  const particlesRef = useRef<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; colorIndex: number }[]>([]);

  // FPS tracking
  const fpsRef = useRef(60);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  // Initialize particle field once
  useEffect(() => {
    const pts = [];
    const count = 3500;
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 80 + Math.random() * 280;
      pts.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        life: Math.random(),
        colorIndex: Math.floor(Math.random() * 4),
      });
    }
    particlesRef.current = pts;
  }, []);

  // Palette color mapper
  const getPaletteColors = useCallback((palette: ColorPalette) => {
    switch (palette) {
      case 'obsidian-cyan':
        return {
          primary: '#00f0ff',
          secondary: '#0077ff',
          accent: '#39ff14',
          bg: '#04070d',
          glow: 'rgba(0, 240, 255, 0.4)',
        };
      case 'solar-flare':
        return {
          primary: '#ffaa00',
          secondary: '#ff3300',
          accent: '#ffe600',
          bg: '#0c0502',
          glow: 'rgba(255, 170, 0, 0.45)',
        };
      case 'infrared':
        return {
          primary: '#ff0055',
          secondary: '#9d4edd',
          accent: '#ffaa00',
          bg: '#0d0208',
          glow: 'rgba(255, 0, 85, 0.45)',
        };
      case 'matrix-emerald':
        return {
          primary: '#39ff14',
          secondary: '#00aa44',
          accent: '#00f0ff',
          bg: '#020904',
          glow: 'rgba(57, 255, 20, 0.4)',
        };
      case 'spectral-void':
        return {
          primary: '#e2e8f0',
          secondary: '#64748b',
          accent: '#00f0ff',
          bg: '#05070a',
          glow: 'rgba(226, 232, 240, 0.3)',
        };
      case 'acid-neon':
      default:
        return {
          primary: '#00f0ff',
          secondary: '#ff0055',
          accent: '#39ff14',
          bg: '#06080e',
          glow: 'rgba(0, 240, 255, 0.5)',
        };
    }
  }, []);

  // Main rendering loop
  useEffect(() => {
    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.016 * params.rotationSpeed;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      // Handle canvas resizing
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // FPS calculation
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 500) {
        fpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      const colors = getPaletteColors(params.colorPalette);
      const freq = audioEngine.getFrequencyData();
      const wave = audioEngine.getTimeDomainData();

      // Audio reactive multipliers
      const bassReact = telemetry.bass * params.reactivity;
      const beatPulse = telemetry.isBeat ? 1.4 : 1.0;
      const trebleReact = telemetry.treble * params.reactivity;

      // 1. Fade / Feedback Trails
      ctx.fillStyle = colors.bg;
      ctx.globalAlpha = Math.max(0.12, 1.0 - params.feedbackTrails * 0.88);
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;

      // Center coords
      const cx = width / 2;
      const cy = height / 2;

      ctx.save();

      // Render mode based on selection
      switch (params.colorPalette ? (canvas.dataset.mode as VisualMode || 'raymarcher') : 'raymarcher') {
        case 'raymarcher':
          drawVolumetricRaymarcher(ctx, cx, cy, width, height, time, telemetry, colors, params);
          break;
        case 'cartography':
          drawSpectralCartography(ctx, cx, cy, width, height, time, freq, colors, params);
          break;
        case 'particles':
          drawQuantumParticles(ctx, cx, cy, width, height, time, telemetry, colors, params);
          break;
        case 'cymatics':
          drawChladniCymatics(ctx, cx, cy, width, height, time, telemetry, colors, params);
          break;
        case 'cyberhud':
          drawCyberHUD(ctx, cx, cy, width, height, time, telemetry, freq, wave, colors, params);
          break;
        case 'tesseract':
          drawTesseractMatrix(ctx, cx, cy, width, height, time, telemetry, colors, params);
          break;
      }

      // Chromatic aberration pass
      if (params.chromaticAberration > 0.05 && telemetry.energy > 0.15) {
        const offset = Math.round(params.chromaticAberration * 8 * bassReact * beatPulse);
        if (offset > 1) {
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = 'rgba(255, 0, 85, 0.15)';
          ctx.drawImage(canvas, offset, 0, width - offset, height, 0, 0, width - offset, height);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
          ctx.drawImage(canvas, 0, 0, width - offset, height, offset, 0, width - offset, height);
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // Glitch slice kick effect
      if (telemetry.isBeat && params.glitchIntensity > 0.2) {
        const sliceY = Math.random() * height;
        const sliceH = 15 + Math.random() * 45;
        const sliceDistort = (Math.random() - 0.5) * 35 * params.glitchIntensity;
        ctx.drawImage(canvas, 0, sliceY, width, sliceH, sliceDistort, sliceY, width, sliceH);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [params, telemetry, getPaletteColors]);

  // ENGINE 1: Volumetric Psychedelic Raymarcher (Torus / Kaleidoscopic Tunnel)
  const drawVolumetricRaymarcher = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    time: number,
    telem: AudioTelemetry,
    colors: ReturnType<typeof getPaletteColors>,
    dspParams: DspParameters
  ) => {
    const numRings = 28;
    const ringSegments = 40;
    const baseRadius = 24 * zoom.current;
    const maxRadius = Math.min(width, height) * 0.65 * zoom.current;
    const bass = telem.bass * dspParams.reactivity;
    const beatK = telem.isBeat ? 1.35 : 1.0;

    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';

    for (let r = 0; r < numRings; r++) {
      const ringRatio = r / numRings;
      const rad = baseRadius + Math.pow(ringRatio, 1.6) * (maxRadius - baseRadius);
      const zOffset = Math.sin(time * 2 + ringRatio * 8) * 45 * bass;
      const twist = time * 0.8 + ringRatio * 6.28 * (1 + telem.mid * 1.5);

      ctx.beginPath();
      for (let s = 0; s <= ringSegments; s++) {
        const theta = (s / ringSegments) * Math.PI * 2;
        // Non-linear harmonic deformation
        const harmonic = Math.sin(theta * 5 + twist) * 18 * bass * beatK +
                         Math.cos(theta * 3 - time * 3) * 12 * telem.treble;
        const currentR = rad + harmonic;

        // 3D projection with user rotation
        const x3d = currentR * Math.cos(theta);
        const y3d = currentR * Math.sin(theta);
        const z3d = zOffset;

        // Apply rotX and rotY
        const cosY = Math.cos(rotY.current);
        const sinY = Math.sin(rotY.current);
        const cosX = Math.cos(rotX.current);
        const sinX = Math.sin(rotX.current);

        const xRot = x3d * cosY + z3d * sinY;
        const zRot1 = -x3d * sinY + z3d * cosY;
        const yRot = y3d * cosX - zRot1 * sinX;
        const zFinal = y3d * sinX + zRot1 * cosX + 400;

        const fovScale = (dspParams.cameraFov * 6) / Math.max(80, zFinal);
        const px = cx + xRot * fovScale;
        const py = cy + yRot * fovScale;

        if (s === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.closePath();
      const alpha = Math.max(0.1, (1.0 - ringRatio * 0.75) * (0.4 + telem.energy * 0.6));
      ctx.strokeStyle = ringRatio < 0.35 
        ? colors.primary 
        : ringRatio < 0.7 
          ? colors.secondary 
          : colors.accent;
      ctx.globalAlpha = alpha;
      ctx.stroke();

      if (dspParams.wireframe && r % 4 === 0) {
        ctx.fillStyle = colors.primary;
        ctx.globalAlpha = 0.08 * telem.energy;
        ctx.fill();
      }
    }

    // Central Singularity Core
    const coreR = (16 + bass * 45) * beatK * zoom.current;
    const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.3, colors.primary);
    coreGrad.addColorStop(0.7, colors.secondary);
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.globalAlpha = 0.75 + telem.energy * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
  };

  // ENGINE 2: Spectral Cartography (Topographic Isoline Terrain)
  const drawSpectralCartography = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    time: number,
    freq: Uint8Array,
    colors: ReturnType<typeof getPaletteColors>,
    dspParams: DspParameters
  ) => {
    // Keep 36 slices of history
    const sliceCount = 36;
    const pointsPerSlice = 64;

    // Sample current frequency slice
    const currentSlice = new Float32Array(pointsPerSlice);
    for (let i = 0; i < pointsPerSlice; i++) {
      const idx = Math.floor(Math.pow(i / pointsPerSlice, 1.8) * 380);
      currentSlice[i] = (freq[idx] || 0) / 255.0;
    }

    if (!historyRef.current) historyRef.current = [];
    historyRef.current.unshift(currentSlice);
    if (historyRef.current.length > sliceCount) {
      historyRef.current.pop();
    }

    const gridW = width * 0.75 * zoom.current;
    const elev = dspParams.elevationScale * 140;

    ctx.lineWidth = 1.3;

    for (let s = historyRef.current.length - 1; s >= 0; s--) {
      const slice = historyRef.current[s];
      const zProgress = s / sliceCount;
      const yBase = cy - 140 + zProgress * 280;
      const depthScale = 0.5 + (1 - zProgress) * 0.65;
      const sliceW = gridW * depthScale;

      ctx.beginPath();
      for (let p = 0; p < pointsPerSlice; p++) {
        const xProgress = p / (pointsPerSlice - 1);
        const xPos = cx - sliceW / 2 + xProgress * sliceW;
        const h = (slice[p] || 0) * elev * depthScale;
        const yPos = yBase - h + Math.sin(xProgress * 8 + time) * 6;

        if (p === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      }

      const alpha = Math.max(0.12, (1 - zProgress * 0.8) * 0.85);
      ctx.strokeStyle = s % 3 === 0 ? colors.accent : s % 2 === 0 ? colors.primary : colors.secondary;
      ctx.globalAlpha = alpha;
      ctx.stroke();

      // Topographic isolines fill
      if (s === 0) {
        ctx.lineTo(cx + sliceW / 2, yBase + 40);
        ctx.lineTo(cx - sliceW / 2, yBase + 40);
        ctx.closePath();
        ctx.fillStyle = colors.glow;
        ctx.globalAlpha = 0.15;
        ctx.fill();
      }
    }
  };

  // ENGINE 3: Quantum Particle Field
  const drawQuantumParticles = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    time: number,
    telem: AudioTelemetry,
    colors: ReturnType<typeof getPaletteColors>,
    dspParams: DspParameters
  ) => {
    const pts = particlesRef.current;
    const bass = telem.bass * dspParams.reactivity;
    const beatK = telem.isBeat ? 2.2 : 1.0;
    const colorList = [colors.primary, colors.secondary, colors.accent, '#ffffff'];

    const cosY = Math.cos(rotY.current + time * 0.3);
    const sinY = Math.sin(rotY.current + time * 0.3);
    const cosX = Math.cos(rotX.current);
    const sinX = Math.sin(rotX.current);

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];

      // Swirling orbital velocity
      const d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1;
      const speed = (0.5 + telem.energy * 2.2) * (150 / (d + 60));
      p.x += -p.y * 0.015 * speed + p.vx * beatK;
      p.y += p.x * 0.015 * speed + p.vy * beatK;
      p.z += p.vz * beatK;

      // Reset if out of bounds
      if (d > 420) {
        p.x = (Math.random() - 0.5) * 80;
        p.y = (Math.random() - 0.5) * 80;
        p.z = (Math.random() - 0.5) * 80;
      }

      // Rotate camera
      const xRot = p.x * cosY + p.z * sinY;
      const zRot1 = -p.x * sinY + p.z * cosY;
      const yRot = p.y * cosX - zRot1 * sinX;
      const zFinal = p.y * sinX + zRot1 * cosX + 380;

      if (zFinal < 40) continue;

      const fov = 380 / zFinal;
      const px = cx + xRot * fov * zoom.current;
      const py = cy + yRot * fov * zoom.current;

      const size = Math.max(1.0, (1.2 + bass * 3.5) * fov * (p.colorIndex === 3 ? 1.5 : 1));
      ctx.fillStyle = colorList[p.colorIndex];
      ctx.globalAlpha = Math.min(1.0, (0.35 + telem.energy * 0.65) * (380 / zFinal));

      ctx.fillRect(px, py, size, size);
    }
  };

  // ENGINE 4: Chladni Cymatics Matrix (Acoustic Nodal Resonance)
  const drawChladniCymatics = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    time: number,
    telem: AudioTelemetry,
    colors: ReturnType<typeof getPaletteColors>,
    dspParams: DspParameters
  ) => {
    // Chladni formula: a*sin(n*x)*sin(m*y) - b*sin(m*x)*sin(n*y) = 0
    const m = 3 + Math.floor(telem.mid * 5);
    const n = 2 + Math.floor(telem.treble * 6);
    const plateSize = Math.min(width, height) * 0.72 * zoom.current;
    const half = plateSize / 2;
    const samples = 140;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotY.current + time * 0.15);

    // Draw Chladni boundary frame
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(-half, -half, plateSize, plateSize);

    // Grid circles
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.stroke();

    // Nodal lines calculation
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = colors.primary;
    ctx.globalAlpha = 0.85;

    for (let i = 0; i <= samples; i += 2) {
      const u = (i / samples) * 2 - 1;
      ctx.beginPath();
      for (let j = 0; j <= samples; j++) {
        const v = (j / samples) * 2 - 1;
        const val = Math.sin(n * Math.PI * u) * Math.sin(m * Math.PI * v) -
                    Math.sin(m * Math.PI * u) * Math.sin(n * Math.PI * v);

        if (Math.abs(val) < 0.12 + telem.bass * 0.18) {
          const px = u * half;
          const py = v * half;
          ctx.lineTo(px, py);
        } else {
          ctx.stroke();
          ctx.beginPath();
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  };

  // ENGINE 5: Cybernetic HUD & Goniometer Phase Radar
  const drawCyberHUD = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    time: number,
    telem: AudioTelemetry,
    freq: Uint8Array,
    wave: Uint8Array,
    colors: ReturnType<typeof getPaletteColors>,
    dspParams: DspParameters
  ) => {
    const rOuter = Math.min(width, height) * 0.42 * zoom.current;

    ctx.save();
    ctx.translate(cx, cy);

    // 1. Outer radar telemetry ring
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
    ctx.stroke();

    // Ticks around ring
    const ticks = 72;
    for (let i = 0; i < ticks; i++) {
      const angle = (i / ticks) * Math.PI * 2;
      const isMajor = i % 6 === 0;
      const r1 = rOuter - (isMajor ? 12 : 5);
      const r2 = rOuter;
      ctx.beginPath();
      ctx.moveTo(r1 * Math.cos(angle), r1 * Math.sin(angle));
      ctx.lineTo(r2 * Math.cos(angle), r2 * Math.sin(angle));
      ctx.strokeStyle = isMajor ? colors.accent : colors.secondary;
      ctx.stroke();
    }

    // 2. Circular FFT Spectrum
    ctx.beginPath();
    const fftPoints = 120;
    for (let i = 0; i <= fftPoints; i++) {
      const angle = (i / fftPoints) * Math.PI * 2 - Math.PI / 2;
      const fVal = (freq[Math.floor(i * 1.5)] || 0) / 255;
      const rVal = rOuter * 0.72 + fVal * 75 * dspParams.reactivity;
      const px = rVal * Math.cos(angle);
      const py = rVal * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.0;
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    // 3. Stereo Goniometer / Lissajous Phase Scope in center
    const gonioSize = rOuter * 0.45;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const s1 = ((wave[i * 2] || 128) - 128) / 128;
      const s2 = ((wave[i * 2 + 1] || 128) - 128) / 128;
      // 45 degree phase rotation
      const xG = (s1 - s2) * 0.707 * gonioSize * (1 + telem.bass);
      const yG = (s1 + s2) * 0.707 * gonioSize * (1 + telem.bass);
      if (i === 0) ctx.moveTo(xG, yG);
      else ctx.lineTo(xG, yG);
    }
    ctx.stroke();

    // 4. Rotating sweep reticle
    const sweepAngle = time * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(rOuter * Math.cos(sweepAngle), rOuter * Math.sin(sweepAngle));
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = 0.5;
    ctx.stroke();

    ctx.restore();
  };

  // ENGINE 6: Hyperspace Tesseract Matrix (4D Hypercube)
  const drawTesseractMatrix = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    width: number,
    height: number,
    time: number,
    telem: AudioTelemetry,
    colors: ReturnType<typeof getPaletteColors>,
    dspParams: DspParameters
  ) => {
    // 16 vertices of a 4D hypercube: (±1, ±1, ±1, ±1)
    const vertices4D: number[][] = [];
    for (let i = 0; i < 16; i++) {
      vertices4D.push([
        (i & 1) ? 1 : -1,
        (i & 2) ? 1 : -1,
        (i & 4) ? 1 : -1,
        (i & 8) ? 1 : -1,
      ]);
    }

    // 4D rotation angles (XW, YZ)
    const angleXW = time * 0.8 + telem.bass * 2.0;
    const angleYZ = time * 0.6 + telem.mid * 1.5;

    const scale = Math.min(width, height) * 0.32 * zoom.current;

    // Projected 2D points
    const points2D: { x: number; y: number; w: number }[] = [];

    for (let i = 0; i < 16; i++) {
      let [x, y, z, w] = vertices4D[i];

      // Rotate in XW plane
      const cosXW = Math.cos(angleXW);
      const sinXW = Math.sin(angleXW);
      const xNew = x * cosXW - w * sinXW;
      const wNew = x * sinXW + w * cosXW;
      x = xNew;
      w = wNew;

      // Rotate in YZ plane
      const cosYZ = Math.cos(angleYZ);
      const sinYZ = Math.sin(angleYZ);
      const yNew = y * cosYZ - z * sinYZ;
      const zNew = y * sinYZ + z * cosYZ;
      y = yNew;
      z = zNew;

      // 4D to 3D perspective projection
      const distance4D = 2.4;
      const proj4D = 1 / (distance4D - w);
      const x3 = x * proj4D;
      const y3 = y * proj4D;
      const z3 = z * proj4D;

      // 3D rotation from user drag
      const cosY = Math.cos(rotY.current);
      const sinY = Math.sin(rotY.current);
      const cosX = Math.cos(rotX.current);
      const sinX = Math.sin(rotX.current);

      const xRot = x3 * cosY + z3 * sinY;
      const zRot1 = -x3 * sinY + z3 * cosY;
      const yRot = y3 * cosX - zRot1 * sinX;
      const zFinal = y3 * sinX + zRot1 * cosX + 3.0;

      const fov = 1.0 / zFinal;
      const px = cx + xRot * fov * scale * 2.5;
      const py = cy + yRot * fov * scale * 2.5;

      points2D.push({ x: px, y: py, w });
    }

    // Draw 32 edges of 4D hypercube
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 16; i++) {
      for (let bit = 1; bit <= 8; bit <<= 1) {
        if (i & bit) {
          const j = i ^ bit;
          const p1 = points2D[i];
          const p2 = points2D[j];

          const edgeColor = bit === 8 ? colors.accent : bit === 4 ? colors.primary : colors.secondary;
          ctx.strokeStyle = edgeColor;
          ctx.globalAlpha = Math.min(1.0, 0.4 + ((p1.w + p2.w) / 4 + 0.5) * 0.55);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // Draw vertices glowing nodes
    for (let i = 0; i < 16; i++) {
      const p = points2D[i];
      const r = (3 + telem.energy * 5) * (1 + (p.w + 1) * 0.4);
      ctx.fillStyle = p.w > 0 ? colors.accent : colors.primary;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Mouse interaction for 3D orbit
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouseX.current = e.clientX;
    lastMouseY.current = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouseX.current;
    const dy = e.clientY - lastMouseY.current;
    rotY.current += dx * 0.008;
    rotX.current += dy * 0.008;
    lastMouseX.current = e.clientX;
    lastMouseY.current = e.clientY;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    zoom.current = Math.max(0.4, Math.min(3.2, zoom.current * factor));
  };

  // Snapshot PNG export
  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `ziaa-dsp-frame-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const modes: { id: VisualMode; label: string; icon: React.ReactNode }[] = [
    { id: 'raymarcher', label: 'Volumetric Psy', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'cartography', label: 'Spectral Carto', icon: <Waves className="w-3.5 h-3.5" /> },
    { id: 'particles', label: 'Quantum Field', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'cymatics', label: 'Chladni Cymatics', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { id: 'cyberhud', label: 'Cyber HUD Scope', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'tesseract', label: '4D Tesseract', icon: <Box className="w-3.5 h-3.5" /> },
  ];

  const currentMode = (canvasRef.current?.dataset.mode as VisualMode) || 'raymarcher';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#05070a] overflow-hidden flex flex-col select-none border border-[#1e2533]/80 rounded-sm"
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-2 px-3 py-1.5 bg-[#090d15]/85 backdrop-blur-md border border-[#222c3d]/90 rounded text-xs text-slate-300">
        {/* Visual Engine Selector Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-mono tracking-wider text-cyan-400 font-bold uppercase mr-1.5 flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400" />
            TOPs:
          </span>
          {modes.map((m) => {
            const isActive = currentMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  if (canvasRef.current) {
                    canvasRef.current.dataset.mode = m.id;
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.25)]'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Viewport Utilities */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {/* Wireframe toggle */}
          <button
            onClick={() => onUpdateParams({ wireframe: !params.wireframe })}
            className={`px-2 py-1 rounded transition-colors ${
              params.wireframe ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Wireframe Shading"
          >
            WIRE
          </button>

          {/* Reset View */}
          <button
            onClick={() => {
              rotX.current = 0.35;
              rotY.current = 0.0;
              zoom.current = 1.0;
            }}
            className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
            title="Reset Orbit Camera"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          {/* Telemetry Overlay Toggle */}
          <button
            onClick={() => setShowOverlayTelemetry(!showOverlayTelemetry)}
            className={`p-1 transition-colors ${showOverlayTelemetry ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            title="Toggle Telemetry HUD"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Snapshot PNG */}
          <button
            onClick={takeSnapshot}
            className="p-1 hover:text-emerald-400 text-slate-400 transition-colors"
            title="Export Frame PNG"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        data-mode="raymarcher"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Telemetry Overlay HUD */}
      {showOverlayTelemetry && (
        <div className="absolute bottom-3 left-3 pointer-events-none z-10 flex flex-col gap-1 font-mono text-[10px] text-slate-400 bg-[#070b12]/80 backdrop-blur-sm p-2 rounded border border-[#1b2333]/90">
          <div className="flex items-center gap-3">
            <span className="text-cyan-400 font-semibold tracking-wider">RENDER PIPELINE</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-bold">{fpsRef.current} FPS</span>
            <span className="text-slate-500">|</span>
            <span>ZOOM: {(zoom.current * 100).toFixed(0)}%</span>
            <span className="text-slate-500">|</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${telemetry.isBeat ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' : 'text-slate-500'}`}>
              BEAT #{telemetry.beatCount}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[9px]">
            <span className="text-slate-400">SUB: <b className="text-cyan-300">{(telemetry.sub * 100).toFixed(0)}%</b></span>
            <span>BASS: <b className="text-cyan-300">{(telemetry.bass * 100).toFixed(0)}%</b></span>
            <span>MID: <b className="text-purple-300">{(telemetry.mid * 100).toFixed(0)}%</b></span>
            <span>TREBLE: <b className="text-pink-300">{(telemetry.treble * 100).toFixed(0)}%</b></span>
            <span>CENTROID: <b className="text-emerald-300">{Math.round(telemetry.centroid)} Hz</b></span>
          </div>
        </div>
      )}

      {/* Right Watermark info */}
      <div className="absolute bottom-3 right-3 pointer-events-none z-10 font-mono text-[9px] text-slate-500/70 text-right">
        <div>ZIAA SPECTRAL LAB // TORUS ENGINE 4.2</div>
        <div className="tracking-widest">DRAG TO ORBIT · SCROLL TO ZOOM</div>
      </div>
    </div>
  );
};
