import React, { useRef, useState, useEffect } from 'react';
import { audioEngine } from '../lib/audioEngine';
import { DspParameters, AudioTelemetry, AudioTrackMeta } from '../types/dsp';
import { 
  Play, 
  Pause, 
  Square, 
  Repeat, 
  Volume2, 
  Clock, 
  Gauge, 
  Music, 
  Radio, 
  FastForward,
  RotateCcw
} from 'lucide-react';

interface WaveformTimelineProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  track: AudioTrackMeta;
  params: DspParameters;
  onUpdateParams: (newParams: Partial<DspParameters>) => void;
  telemetry: AudioTelemetry;
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  isPlaying,
  onTogglePlay,
  onStop,
  track,
  params,
  onUpdateParams,
  telemetry,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrubbing = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Sync current time with audioEngine
  useEffect(() => {
    let animId: number;
    const updateTime = () => {
      setCurrentTime(audioEngine.getCurrentTime());
      animId = requestAnimationFrame(updateTime);
    };
    animId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const duration = audioEngine.getDuration() || 180;
    const progress = Math.min(1.0, Math.max(0, currentTime / duration));
    const peaks = audioEngine.getWaveformPeaks();

    // Background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Bars (Beat / Bar markers)
    const totalBars = 32;
    ctx.strokeStyle = '#182233';
    ctx.lineWidth = 1;
    for (let i = 0; i < totalBars; i++) {
      const x = (i / totalBars) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Bar number text
      if (i % 4 === 0) {
        ctx.fillStyle = '#334460';
        ctx.font = '9px monospace';
        ctx.fillText(`BAR ${i + 1}`, x + 4, 11);
      }
    }

    // Center baseline
    const midY = height / 2;
    ctx.strokeStyle = '#151e2e';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Draw Waveform Bars
    const barCount = peaks.length;
    const barWidth = Math.max(1, width / barCount - 1);

    for (let i = 0; i < barCount; i++) {
      const x = (i / barCount) * width;
      const peakVal = peaks[i] || 0.05;
      const barH = peakVal * (height * 0.42);

      const isPlayed = i / barCount <= progress;
      if (isPlayed) {
        ctx.fillStyle = telemetry.isBeat ? '#00f0ff' : '#0ea5e9';
      } else {
        ctx.fillStyle = '#1e293b';
      }

      // Upper bar
      ctx.fillRect(x, midY - barH, barWidth, barH);
      // Lower bar
      ctx.fillRect(x, midY, barWidth, barH * 0.85);
    }

    // Draw Playhead Line
    const playheadX = progress * width;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Playhead arrow indicator
    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.moveTo(playheadX - 5, 0);
    ctx.lineTo(playheadX + 5, 0);
    ctx.lineTo(playheadX, 8);
    ctx.closePath();
    ctx.fill();
  }, [currentTime, telemetry]);

  // Scrub seeking
  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const duration = audioEngine.getDuration() || 180;
    audioEngine.seek(pct * duration);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isScrubbing.current = true;
    handleSeek(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isScrubbing.current) {
      handleSeek(e);
    }
  };

  const handleMouseUp = () => {
    isScrubbing.current = false;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const duration = audioEngine.getDuration() || 180;

  return (
    <div className="flex flex-col bg-[#070b12] border-t border-[#1a2333] px-3 py-2 select-none font-mono text-xs">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-3 mb-2">
        {/* Playback Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold cursor-pointer transition-all shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          {/* Stop Button */}
          <button
            onClick={onStop}
            className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Stop & Rewind"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          {/* Loop Button */}
          <button
            onClick={() => onUpdateParams({ loop: !params.loop })}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              params.loop
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Seamless Loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Timecode Readout */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#0d131f] border border-[#202b3d] rounded text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-emerald-400 font-bold tracking-wider">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Center Track Info */}
        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-slate-200 font-semibold truncate max-w-[240px]">{track.title}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400">{track.bpm} BPM</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400">{track.key}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">48kHz / 32-bit</span>
        </div>

        {/* Right Playback Rate & Master Volume Quick Controls */}
        <div className="flex items-center gap-3">
          {/* Playback Rate / Varispeed */}
          <div className="flex items-center gap-1 bg-[#0d131f] border border-[#202b3d] rounded px-2 py-0.5 text-[11px]">
            <Gauge className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">SPEED:</span>
            {[0.5, 1.0, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => onUpdateParams({ playbackRate: rate })}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  params.playbackRate === rate
                    ? 'bg-cyan-500/30 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Master Volume Quick Slider */}
          <div className="flex items-center gap-1.5 bg-[#0d131f] border border-[#202b3d] rounded px-2 py-1">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <input
              type="range"
              min="0"
              max="1.2"
              step="0.02"
              value={params.masterVolume}
              onChange={(e) => onUpdateParams({ masterVolume: Number(e.target.value) })}
              className="w-16 accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
            <span className="text-[10px] text-slate-300 w-7 text-right">
              {(params.masterVolume * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Waveform Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-16 bg-[#04060a] border border-[#1a2333] rounded cursor-crosshair overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full block"
        />

        {/* Transient Markers Overlay */}
        <div className="absolute top-1 left-2 pointer-events-none text-[9px] text-slate-500 font-mono tracking-wider">
          MASTER BUFFER // TIMELINE OVERVIEW · SCRUB TO POSITION
        </div>
      </div>
    </div>
  );
};
