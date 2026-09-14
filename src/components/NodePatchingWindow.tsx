import React, { useState, useRef } from 'react';
import { PatchNode, PatchCable, DspParameters, AudioTelemetry } from '../types/dsp';
import { 
  X, 
  Minus, 
  Plus, 
  Lock, 
  Unlock, 
  Maximize2, 
  Minimize2, 
  Sliders, 
  Radio, 
  Tv, 
  Volume2, 
  Trash2,
  Share2
} from 'lucide-react';

interface NodePatchingProps {
  nodes: PatchNode[];
  cables: PatchCable[];
  onUpdateNodes: (nodes: PatchNode[]) => void;
  onUpdateCables: (cables: PatchCable[]) => void;
  onUpdateDspParams: (params: Partial<DspParameters>) => void;
  dspParams: DspParameters;
  telemetry: AudioTelemetry;
  isOpen: boolean;
  onClose: () => void;
}

export const NodePatchingWindow: React.FC<NodePatchingProps> = ({
  nodes,
  cables,
  onUpdateNodes,
  onUpdateCables,
  onUpdateDspParams,
  dspParams,
  telemetry,
  isOpen,
  onClose,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 40, y: 50 });
  const [draggingWindow, setDraggingWindow] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  // Cable drawing state
  const [cableStart, setCableStart] = useState<{
    nodeId: string;
    socketId: string;
    isOutput: boolean;
    type: 'audio' | 'control' | 'texture';
    x: number;
    y: number;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Window drag handlers
  const handleWindowMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    setDraggingWindow(true);
    setDragOffset({
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y,
    });
  };

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (draggingWindow && !isMaximized) {
      setWindowPos({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y),
      });
    }

    if (draggingNodeId && !isLocked) {
      const updatedNodes = nodes.map((n) => {
        if (n.id === draggingNodeId) {
          return {
            ...n,
            x: Math.max(10, e.clientX - nodeDragOffset.x),
            y: Math.max(10, e.clientY - nodeDragOffset.y),
          };
        }
        return n;
      });
      onUpdateNodes(updatedNodes);
    }

    if (cableStart && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleGlobalMouseUp = () => {
    setDraggingWindow(false);
    setDraggingNodeId(null);
    setCableStart(null);
  };

  // Node drag start
  const handleNodeMouseDown = (e: React.MouseEvent, node: PatchNode) => {
    if (isLocked) return;
    if ((e.target as HTMLElement).closest('.socket-pin') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setNodeDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    });
  };

  // Socket click / drag handlers for patching
  const handleSocketMouseDown = (
    e: React.MouseEvent,
    node: PatchNode,
    socketId: string,
    isOutput: boolean,
    type: 'audio' | 'control' | 'texture'
  ) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pinRect = (e.target as HTMLElement).getBoundingClientRect();

    setCableStart({
      nodeId: node.id,
      socketId,
      isOutput,
      type,
      x: pinRect.left + pinRect.width / 2 - rect.left,
      y: pinRect.top + pinRect.height / 2 - rect.top,
    });
  };

  const handleSocketMouseUp = (
    e: React.MouseEvent,
    targetNode: PatchNode,
    targetSocketId: string,
    isTargetOutput: boolean
  ) => {
    e.stopPropagation();
    if (!cableStart) return;

    // Must connect an output to an input
    if (cableStart.isOutput !== isTargetOutput && cableStart.nodeId !== targetNode.id) {
      const fromNodeId = cableStart.isOutput ? cableStart.nodeId : targetNode.id;
      const fromSocketId = cableStart.isOutput ? cableStart.socketId : targetSocketId;
      const toNodeId = cableStart.isOutput ? targetNode.id : cableStart.nodeId;
      const toSocketId = cableStart.isOutput ? targetSocketId : cableStart.socketId;

      const color =
        cableStart.type === 'audio'
          ? '#00f0ff'
          : cableStart.type === 'control'
            ? '#ff0055'
            : '#39ff14';

      const newCable: PatchCable = {
        id: `cable-${Date.now()}`,
        fromNodeId,
        fromSocketId,
        toNodeId,
        toSocketId,
        color,
      };

      onUpdateCables([...cables, newCable]);
    }
    setCableStart(null);
  };

  // Sever cable on click
  const handleCableClick = (cableId: string) => {
    onUpdateCables(cables.filter((c) => c.id !== cableId));
  };

  // Add new operator node
  const addNode = (type: PatchNode['type']) => {
    const id = `node-${type}-${Date.now().toString(36)}`;
    let title = 'new_operator';
    let category: PatchNode['category'] = 'dsp';
    let inputs: PatchNode['inputs'] = [];
    let outputs: PatchNode['outputs'] = [];

    switch (type) {
      case 'spectral-filter':
        title = 'biquad~ [filter]';
        category = 'dsp';
        inputs = [{ id: 'audio-in', label: 'Sig In', type: 'audio' }, { id: 'mod', label: 'Mod Q', type: 'control' }];
        outputs = [{ id: 'audio-out', label: 'Sig Out', type: 'audio' }];
        break;
      case 'lfo-matrix':
        title = 'lfo.quad [mod]';
        category = 'mod';
        inputs = [{ id: 'sync', label: 'Sync In', type: 'control' }];
        outputs = [{ id: 'lfo1', label: 'LFO Sin', type: 'control' }, { id: 'lfo2', label: 'LFO Tri', type: 'control' }];
        break;
      case 'hallucination-dsp':
        title = 'tape.warper~ [dsp]';
        category = 'dsp';
        inputs = [{ id: 'audio-in', label: 'Sig In', type: 'audio' }];
        outputs = [{ id: 'audio-out', label: 'Sig Out', type: 'audio' }];
        break;
      case 'cymatics-top':
        title = 'chladni.TOP [plate]';
        category = 'visual';
        inputs = [{ id: 'audio-in', label: 'Sig In', type: 'audio' }];
        outputs = [{ id: 'tex-out', label: 'Matrix Out', type: 'texture' }];
        break;
      default:
        title = 'math.op~';
        inputs = [{ id: 'in1', label: 'In', type: 'control' }];
        outputs = [{ id: 'out1', label: 'Out', type: 'control' }];
    }

    const newNode: PatchNode = {
      id,
      type,
      title,
      category,
      x: 180 + Math.random() * 200,
      y: 120 + Math.random() * 160,
      inputs,
      outputs,
      params: { gain: 0.8, active: true },
    };

    onUpdateNodes([...nodes, newNode]);
  };

  // Calculate socket coordinates for rendering Bezier patch cables
  const getSocketCoord = (nodeId: string, socketId: string, isOutput: boolean) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const nodeWidth = 190;
    const headerHeight = 28;

    if (isOutput) {
      const idx = node.outputs.findIndex((s) => s.id === socketId);
      const topOffset = headerHeight + 16 + (idx >= 0 ? idx : 0) * 22;
      return { x: node.x + nodeWidth, y: node.y + topOffset };
    } else {
      const idx = node.inputs.findIndex((s) => s.id === socketId);
      const topOffset = headerHeight + 16 + (idx >= 0 ? idx : 0) * 22;
      return { x: node.x, y: node.y + topOffset };
    }
  };

  return (
    <div
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
      style={{
        transform: isMaximized
          ? 'none'
          : `translate3d(${windowPos.x}px, ${windowPos.y}px, 0)`,
        position: isMaximized ? 'fixed' : 'absolute',
        top: isMaximized ? 48 : 0,
        left: isMaximized ? 0 : 0,
        right: isMaximized ? 0 : 'auto',
        bottom: isMaximized ? 0 : 'auto',
        width: isMaximized ? '100vw' : isMinimized ? 340 : 860,
        height: isMaximized ? 'calc(100vh - 48px)' : isMinimized ? 42 : 540,
        zIndex: 50,
      }}
      className="flex flex-col bg-[#0b0e14]/95 backdrop-blur-xl border border-cyan-500/30 rounded shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-75 select-none"
    >
      {/* Titlebar with Max/MSP aesthetic */}
      <div
        onMouseDown={handleWindowMouseDown}
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#0d121c] via-[#121926] to-[#0d121c] border-b border-[#222e42] cursor-move text-xs font-mono"
      >
        <div className="flex items-center gap-2">
          {/* Status LED */}
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse" />
          <span className="text-cyan-300 font-bold tracking-wider">
            [MAX/TD MODULAR PATCHER // patch_matrix_v3.maxpat]
          </span>
          <span className="text-[10px] text-slate-500">
            {nodes.length} nodes · {cables.length} cords
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          {/* Lock / Unlock Toggle */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`p-1 rounded cursor-pointer transition-colors ${
              isLocked
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={isLocked ? 'Patch Locked (Run Mode)' : 'Patch Unlocked (Edit Mode)'}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          {/* Add Node Menu */}
          {!isLocked && !isMinimized && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => addNode('spectral-filter')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 rounded text-[10px] text-slate-300 transition-colors"
              >
                + biquad~
              </button>
              <button
                onClick={() => addNode('lfo-matrix')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-pink-500/20 hover:text-pink-300 border border-slate-700 hover:border-pink-500/40 rounded text-[10px] text-slate-300 transition-colors"
              >
                + lfo.quad
              </button>
              <button
                onClick={() => addNode('hallucination-dsp')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-purple-500/20 hover:text-purple-300 border border-slate-700 hover:border-purple-500/40 rounded text-[10px] text-slate-300 transition-colors"
              >
                + dsp.warper~
              </button>
            </div>
          )}

          {/* Minimize */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 hover:bg-rose-500/30 hover:text-rose-300 text-slate-400 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Body (Hidden if minimized) */}
      {!isMinimized && (
        <div
          ref={canvasRef}
          className="relative flex-1 bg-[#07090f] overflow-auto select-none"
          style={{
            backgroundImage: `radial-gradient(#1f293d 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        >
          {/* SVG Patch Cables Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ minWidth: 1400, minHeight: 900 }}>
            <defs>
              <linearGradient id="cable-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ff0055" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Existing Cables */}
            {cables.map((c) => {
              const start = getSocketCoord(c.fromNodeId, c.fromSocketId, true);
              const end = getSocketCoord(c.toNodeId, c.toSocketId, false);
              const dx = Math.abs(end.x - start.x) * 0.55;
              const pathD = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;

              return (
                <g key={c.id} className="cursor-pointer pointer-events-auto group" onClick={() => handleCableClick(c.id)}>
                  {/* Invisible thicker hit-box */}
                  <path d={pathD} stroke="transparent" strokeWidth="14" fill="none" />
                  {/* Glowing background */}
                  <path d={pathD} stroke={c.color} strokeWidth="4" strokeOpacity="0.25" fill="none" />
                  {/* Core cable */}
                  <path
                    d={pathD}
                    stroke={c.color}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={telemetry.energy > 0.2 ? '6,3' : 'none'}
                    className={telemetry.energy > 0.2 ? 'animate-pulse' : ''}
                  />
                  {/* Dynamic pulse dot traveling along cord */}
                  <circle r="3" fill="#ffffff" opacity="0.9">
                    <animateMotion path={pathD} dur={`${Math.max(0.6, 2.5 - telemetry.energy * 1.8)}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}

            {/* Active Drawing Cable */}
            {cableStart && (
              <path
                d={`M ${cableStart.x} ${cableStart.y} C ${cableStart.x + 60} ${cableStart.y}, ${mousePos.x - 60} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                stroke="#00f0ff"
                strokeWidth="2.5"
                strokeDasharray="4,4"
                fill="none"
                opacity="0.85"
              />
            )}
          </svg>

          {/* Interactive Nodes */}
          <div className="relative min-w-[1400px] min-h-[900px] p-6 z-20">
            {nodes.map((node) => {
              const isDraggingThis = draggingNodeId === node.id;
              const categoryColor =
                node.category === 'audio'
                  ? 'border-cyan-500/50 text-cyan-400'
                  : node.category === 'dsp'
                    ? 'border-emerald-500/50 text-emerald-400'
                    : node.category === 'visual'
                      ? 'border-purple-500/50 text-purple-400'
                      : node.category === 'mod'
                        ? 'border-pink-500/50 text-pink-400'
                        : 'border-amber-500/50 text-amber-400';

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                    width: 200,
                  }}
                  className={`absolute bg-[#0f141f]/95 border ${categoryColor} rounded shadow-lg backdrop-blur-md font-mono text-xs select-none transition-shadow ${
                    isDraggingThis ? 'shadow-[0_0_20px_rgba(0,240,255,0.4)] z-30' : 'z-20'
                  }`}
                >
                  {/* Node Header */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#141b2b] border-b border-[#222d42] cursor-grab active:cursor-grabbing">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span className="font-semibold truncate text-[11px]">{node.title}</span>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => onUpdateNodes(nodes.filter((n) => n.id !== node.id))}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Node Body with Sockets & Knobs */}
                  <div className="p-2.5 flex flex-col gap-2">
                    {/* Inputs & Outputs Grid */}
                    <div className="flex justify-between gap-2 text-[10px]">
                      {/* Inputs Column */}
                      <div className="flex flex-col gap-1.5">
                        {node.inputs.map((inp) => (
                          <div
                            key={inp.id}
                            className="flex items-center gap-1.5 cursor-pointer socket-pin"
                            onMouseDown={(e) => handleSocketMouseDown(e, node, inp.id, false, inp.type)}
                            onMouseUp={(e) => handleSocketMouseUp(e, node, inp.id, false)}
                          >
                            <div
                              className={`w-2.5 h-2.5 rounded-full border ${
                                inp.type === 'audio'
                                  ? 'bg-cyan-500/40 border-cyan-400'
                                  : inp.type === 'control'
                                    ? 'bg-pink-500/40 border-pink-400'
                                    : 'bg-emerald-500/40 border-emerald-400'
                              } hover:scale-125 transition-transform`}
                            />
                            <span className="text-slate-400 text-[9px] truncate max-w-[65px]">{inp.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Outputs Column */}
                      <div className="flex flex-col gap-1.5 items-end">
                        {node.outputs.map((out) => (
                          <div
                            key={out.id}
                            className="flex items-center gap-1.5 cursor-pointer socket-pin"
                            onMouseDown={(e) => handleSocketMouseDown(e, node, out.id, true, out.type)}
                            onMouseUp={(e) => handleSocketMouseUp(e, node, out.id, true)}
                          >
                            <span className="text-slate-400 text-[9px] truncate max-w-[65px]">{out.label}</span>
                            <div
                              className={`w-2.5 h-2.5 rounded-full border ${
                                out.type === 'audio'
                                  ? 'bg-cyan-500/40 border-cyan-400'
                                  : out.type === 'control'
                                    ? 'bg-pink-500/40 border-pink-400'
                                    : 'bg-emerald-500/40 border-emerald-400'
                              } hover:scale-125 transition-transform`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Node Parameters (Dynamic based on type) */}
                    <div className="mt-1 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1.5 text-[10px]">
                      {node.type === 'spectral-filter' && (
                        <>
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Cutoff:</span>
                            <span className="text-cyan-300">{Math.round(dspParams.filterCutoff)}Hz</span>
                          </div>
                          <input
                            type="range"
                            min="40"
                            max="18000"
                            value={dspParams.filterCutoff}
                            onChange={(e) => onUpdateDspParams({ filterCutoff: Number(e.target.value) })}
                            className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                          />
                        </>
                      )}

                      {node.type === 'lfo-matrix' && (
                        <>
                          <div className="flex justify-between items-center text-slate-400">
                            <span>LFO1 Rate:</span>
                            <span className="text-pink-300">{dspParams.lfo1Rate.toFixed(2)}Hz</span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="10"
                            step="0.05"
                            value={dspParams.lfo1Rate}
                            onChange={(e) => onUpdateDspParams({ lfo1Rate: Number(e.target.value) })}
                            className="w-full accent-pink-400 h-1 bg-slate-800 rounded cursor-pointer"
                          />
                        </>
                      )}

                      {node.type === 'hallucination-dsp' && (
                        <>
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Haas Width:</span>
                            <span className="text-emerald-300">{(dspParams.stereoWidth * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={dspParams.stereoWidth}
                            onChange={(e) => onUpdateDspParams({ stereoWidth: Number(e.target.value) })}
                            className="w-full accent-emerald-400 h-1 bg-slate-800 rounded cursor-pointer"
                          />
                        </>
                      )}

                      {node.type === 'reverb-space' && (
                        <>
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Reverb Wet:</span>
                            <span className="text-purple-300">{(dspParams.reverbWet * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.02"
                            value={dspParams.reverbWet}
                            onChange={(e) => onUpdateDspParams({ reverbWet: Number(e.target.value) })}
                            className="w-full accent-purple-400 h-1 bg-slate-800 rounded cursor-pointer"
                          />
                        </>
                      )}

                      {node.type === 'master-out' && (
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-slate-400">Master Gain:</span>
                          <span className="text-cyan-300">{(dspParams.masterVolume * 100).toFixed(0)}%</span>
                        </div>
                      )}

                      {node.type === 'fft-splitter' && (
                        <div className="flex items-center gap-1 h-3 mt-0.5 bg-slate-900 rounded p-0.5">
                          <div className="h-full bg-cyan-400 rounded-sm" style={{ width: `${telemetry.energy * 100}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Helper Banner */}
          <div className="absolute bottom-2 left-3 pointer-events-none text-[10px] font-mono text-slate-500 flex items-center gap-2">
            <span>DRAG FROM SOCKET TO PATCH</span>
            <span>·</span>
            <span>CLICK CABLE TO SEVER</span>
            <span>·</span>
            <span>LOCK PATCH TO PREVENT DRAGGING</span>
          </div>
        </div>
      )}
    </div>
  );
};
