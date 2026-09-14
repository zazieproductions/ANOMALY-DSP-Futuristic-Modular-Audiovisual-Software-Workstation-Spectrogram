import React, { useRef, useEffect, useState } from 'react';
import { audioEngine } from '../lib/audioEngine';
import { AudioTelemetry } from '../types/dsp';
import { Activity, BarChart2, Radio, Zap, Disc } from 'lucide-react';

interface SpectrogramProps {
  telemetry: AudioTelemetry;
}

export const SpectrogramAnalyzer: React.FC<SpectrogramProps> = ({ telemetry }) => {
  const barsCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const peakHolds = useRef<number[]>(new Array(32).fill(0));
  const [viewMode, setViewMode] = useState<'both' | 'bars' | 'waterfall'>('both');

  // Draw 32-band FFT Spectrum with peak holds
  useEffect(() => {
    let animId: number;

    const drawBars = () => {
      const canvas = barsCanvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(drawBars);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(drawBars);
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const freqData = audioEngine.getFrequencyData();
      const numBars = 32;
      const barSpacing = 2;
      const barWidth = (width - (numBars - 1) * barSpacing) / numBars;

      ctx.fillStyle = '#070a10';
      ctx.fillRect(0, 0, width, height);

      // Draw dB grid lines
      ctx.strokeStyle = '#141c2b';
      ctx.lineWidth = 1;
      const dbLines = [0.2, 0.4, 0.6, 0.8];
      dbLines.forEach((yPct) => {
        const y = height * (1 - yPct);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });

      // Sample 32 logarithmic bands
      for (let i = 0; i < numBars; i++) {
        const binIndex = Math.floor(Math.pow(i / numBars, 1.9) * 360) + 1;
        const rawVal = (freqData[binIndex] || 0) / 255;
        const barH = rawVal * (height - 18);

        // Update peak hold with decay
        if (rawVal > peakHolds.current[i]) {
          peakHolds.current[i] = rawVal;
        } else {
          peakHolds.current[i] = Math.max(0, peakHolds.current[i] - 0.008);
        }

        const x = i * (barWidth + barSpacing);
        const y = height - barH - 12;

        // Gradient based on frequency band
        const grad = ctx.createLinearGradient(0, height - 12, 0, y);
        if (i < 4) {
          // Sub-bass
          grad.addColorStop(0, '#00f0ff');
          grad.addColorStop(1, '#0088ff');
        } else if (i < 12) {
          // Bass & Low Mid
          grad.addColorStop(0, '#00f0ff');
          grad.addColorStop(1, '#39ff14');
        } else if (i < 22) {
          // Mid & High Mid
          grad.addColorStop(0, '#39ff14');
          grad.addColorStop(1, '#ffaa00');
        } else {
          // Treble
          grad.addColorStop(0, '#ffaa00');
          grad.addColorStop(1, '#ff0055');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barH);

        // Peak tick
        const peakY = height - peakHolds.current[i] * (height - 18) - 12;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, peakY - 1, barWidth, 2);
      }

      // Frequency Band Labels on bottom
      ctx.fillStyle = '#64748b';
      ctx.font = '8px monospace';
      const bandLabels = ['20Hz', '80Hz', '250', '500', '1k', '2.5k', '6k', '14kHz'];
      bandLabels.forEach((label, idx) => {
        const x = (idx / (bandLabels.length - 1)) * (width - 32) + 2;
        ctx.fillText(label, x, height - 2);
      });

      animId = requestAnimationFrame(drawBars);
    };

    animId = requestAnimationFrame(drawBars);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Draw 2D Scrolling Waterfall Spectrogram
  useEffect(() => {
    let animId: number;

    const drawWaterfall = () => {
      const canvas = waterfallCanvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(drawWaterfall);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(drawWaterfall);
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = '#06080e';
        ctx.fillRect(0, 0, width, height);
      }

      // Shift existing pixels left by 2px
      ctx.drawImage(canvas, -2, 0);

      // Draw newest column at the right edge
      const freqData = audioEngine.getFrequencyData();
      const numBins = 128;
      const colW = 2;
      const rightX = width - colW;

      for (let b = 0; b < numBins; b++) {
        // Logarithmic frequency mapping
        const binIdx = Math.floor(Math.pow(b / numBins, 2.0) * 450);
        const val = (freqData[binIdx] || 0) / 255;
        const y = height - (b / numBins) * height;

        // Vivid colormap: black -> purple -> cyan -> orange -> white
        let r = 0, g = 0, bl = 0;
        if (val < 0.25) {
          const t = val / 0.25;
          r = Math.floor(t * 80);
          g = Math.floor(t * 20);
          bl = Math.floor(t * 140);
        } else if (val < 0.6) {
          const t = (val - 0.25) / 0.35;
          r = Math.floor(80 * (1 - t) + 0 * t);
          g = Math.floor(20 * (1 - t) + 240 * t);
          bl = Math.floor(140 * (1 - t) + 255 * t);
        } else if (val < 0.85) {
          const t = (val - 0.6) / 0.25;
          r = Math.floor(255 * t);
          g = Math.floor(240 * (1 - t) + 170 * t);
          bl = Math.floor(255 * (1 - t));
        } else {
          const t = (val - 0.85) / 0.15;
          r = 255;
          g = Math.floor(170 + 85 * t);
          bl = Math.floor(255 * t);
        }

        ctx.fillStyle = `rgb(${r},${g},${bl})`;
        ctx.fillRect(rightX, y, colW, height / numBins + 1);
      }

      animId = requestAnimationFrame(drawWaterfall);
    };

    animId = requestAnimationFrame(drawWaterfall);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="flex flex-col bg-[#070b12] border-t border-[#1a2333] px-3 py-2 text-xs font-mono select-none">
      {/* Header and Telemetry badges */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#162030] mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-300 font-bold uppercase tracking-wider text-[11px]">
            SPECTRAL CARTOGRAPHY // FFT ANALYZER
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[10px] text-slate-400">2048-pt FFT · 32 Octave Bands</span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 text-[10px]">
          <button
            onClick={() => setViewMode('both')}
            className={`px-2 py-0.5 rounded transition-colors ${
              viewMode === 'both' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DUAL
          </button>
          <button
            onClick={() => setViewMode('bars')}
            className={`px-2 py-0.5 rounded transition-colors ${
              viewMode === 'bars' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BARS
          </button>
          <button
            onClick={() => setViewMode('waterfall')}
            className={`px-2 py-0.5 rounded transition-colors ${
              viewMode === 'waterfall' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            WATERFALL
          </button>
        </div>
      </div>

      {/* Main Dual Spectrum Canvas Viewport */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-28">
        {/* FFT Bar Graph */}
        {(viewMode === 'both' || viewMode === 'bars') && (
          <div className="relative w-full h-full bg-[#05070d] border border-[#172236] rounded overflow-hidden">
            <canvas ref={barsCanvasRef} className="w-full h-full block" />
            <div className="absolute top-1 left-2 pointer-events-none text-[9px] text-cyan-400/70 font-mono">
              32-BAND FREQUENCY SPECTRUM (dBFS)
            </div>
          </div>
        )}

        {/* 2D Waterfall Ribbon */}
        {(viewMode === 'both' || viewMode === 'waterfall') && (
          <div className="relative w-full h-full bg-[#05070d] border border-[#172236] rounded overflow-hidden">
            <canvas ref={waterfallCanvasRef} className="w-full h-full block" />
            <div className="absolute top-1 left-2 pointer-events-none text-[9px] text-emerald-400/70 font-mono">
              REAL-TIME SPECTROGRAM WATERFALL (TIME SCROLL)
            </div>
          </div>
        )}
      </div>

      {/* Numerical Telemetry Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-2 pt-1.5 border-t border-[#141b2b] text-[10px]">
        <div className="flex flex-col bg-[#0b101a] px-2 py-1 rounded border border-[#192438]">
          <span className="text-slate-400">PEAK dBFS</span>
          <span className={`font-bold ${telemetry.peakDb > -1 ? 'text-rose-400' : 'text-cyan-300'}`}>
            {telemetry.peakDb.toFixed(1)} dB
          </span>
        </div>

        <div className="flex flex-col bg-[#0b101a] px-2 py-1 rounded border border-[#192438]">
          <span className="text-slate-400">RMS LEVEL</span>
          <span className="text-emerald-300 font-bold">{telemetry.rmsDb.toFixed(1)} dB</span>
        </div>

        <div className="flex flex-col bg-[#0b101a] px-2 py-1 rounded border border-[#192438]">
          <span className="text-slate-400">SPECTRAL CENTROID</span>
          <span className="text-purple-300 font-bold">{Math.round(telemetry.centroid)} Hz</span>
        </div>

        <div className="flex flex-col bg-[#0b101a] px-2 py-1 rounded border border-[#192438]">
          <span className="text-slate-400">SPECTRAL FLATNESS</span>
          <span className="text-amber-300 font-bold">{(telemetry.flatness * 100).toFixed(0)}%</span>
        </div>

        <div className="flex flex-col bg-[#0b101a] px-2 py-1 rounded border border-[#192438]">
          <span className="text-slate-400">PHASE CORRELATION</span>
          <span className="text-cyan-300 font-bold">{telemetry.phaseCorrelation.toFixed(2)} r</span>
        </div>

        <div className="flex flex-col bg-[#0b101a] px-2 py-1 rounded border border-[#192438]">
          <span className="text-slate-400">TRANSIENT BEATS</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${telemetry.isBeat ? 'bg-amber-400 shadow-[0_0_8px_#ffaa00]' : 'bg-slate-700'}`} />
            <span className="text-amber-300 font-bold">#{telemetry.beatCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
