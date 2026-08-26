import React, { useState, useEffect } from 'react';
import { BeadData } from '../types';

interface RosaryRendererProps {
  rgbaBeads: BeadData[];
  cmykBeads: BeadData[];
  activeRgbaId: string;
  activeCmykId: string;
  onBeadClick?: (beadId: string) => void;
  theme?: string;
}

export const RosaryRenderer: React.FC<RosaryRendererProps> = ({
  rgbaBeads,
  cmykBeads,
  activeRgbaId,
  activeCmykId,
  onBeadClick,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  // View mode state: 'rgba' | 'cmyk' | 'both' (default to single column 'rgba')
  const [viewMode, setViewMode] = useState<'rgba' | 'cmyk' | 'both'>('rgba');

  // Track window resize
  useEffect(() => {
    const handleResize = () => {
      // Keep user choice or default single column
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSingle = viewMode !== 'both';
  const cxRgba = viewMode === 'both' ? 260 : (viewMode === 'rgba' ? 500 : -9999);
  const cxCmyk = viewMode === 'both' ? 740 : (viewMode === 'cmyk' ? 500 : -9999);

  const cy = 250; // common center Y
  const rx = isSingle ? 245 : 190; // horizontal radius
  const ry = isSingle ? 180 : 160; // vertical radius
  const crossY = isSingle ? 600 : 590; // vertical alignment for cross

  // Calculate coordinates for loop beads (indices 7 to 60)
  const getLoopCoordinates = (cx: number, idx: number) => {
    // 54 beads in the loop (7 to 60). We map them clockwise around the oval.
    const k = idx - 7;
    const totalBeads = 54;
    const angle = Math.PI / 2 + ((k + 1) * (2 * Math.PI)) / (totalBeads + 1);
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    return { x, y };
  };

  // Get coordinates for any bead by its index (0 to 60)
  const getBeadCoords = (cx: number, bead: BeadData) => {
    const idx = bead.index;
    if (idx === 0) {
      // Cross
      return { x: cx, y: crossY };
    } else if (idx === 1) {
      // Intro Our Father
      return { x: cx, y: crossY - (isSingle ? 65 : 55) };
    } else if (idx === 2) {
      // Virtue 1
      return { x: cx, y: crossY - (isSingle ? 100 : 85) };
    } else if (idx === 3) {
      // Virtue 2
      return { x: cx, y: crossY - (isSingle ? 130 : 110) };
    } else if (idx === 4) {
      // Virtue 3
      return { x: cx, y: crossY - (isSingle ? 160 : 135) };
    } else if (idx === 5) {
      // Intro Glory Be
      return { x: cx, y: crossY - (isSingle ? 190 : 160) };
    } else if (idx === 6) {
      // Connector sits in the middle of the loop
      return { x: cx, y: cy };
    } else {
      // Loop beads (7 to 60)
      return getLoopCoordinates(cx, idx);
    }
  };

  const getBeadColorStyle = (colorType: string, isActive: boolean, id: string = "") => {
    switch (colorType) {
      case 'white':
        return {
          fill: 'url(#grad-white)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : (isLight ? '#cbd5e1' : '#D1D5DB'),
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(255, 255, 255, 0.8)'
        };
      case 'black':
        return {
          fill: 'url(#grad-black)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#F3F4F6') : (isLight ? '#475569' : '#4B5563'),
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(255, 255, 255, 0.4)'
        };
      case 'red':
        return {
          fill: 'url(#grad-red)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : '#991B1B',
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(239, 68, 68, 0.8)'
        };
      case 'green':
        return {
          fill: 'url(#grad-green)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : '#166534',
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(34, 197, 94, 0.8)'
        };
      case 'blue':
        return {
          fill: 'url(#grad-blue)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : '#1E40AF',
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(59, 130, 246, 0.8)'
        };
      case 'cyan':
        return {
          fill: 'url(#grad-cyan)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : '#155E75',
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(6, 182, 212, 0.8)'
        };
      case 'magenta':
        return {
          fill: 'url(#grad-magenta)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : '#86198F',
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(217, 70, 239, 0.8)'
        };
      case 'yellow':
        return {
          fill: 'url(#grad-yellow)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : '#854D0E',
          strokeWidth: isActive ? (isSingle ? 3 : 2) : 1,
          glow: 'rgba(234, 179, 8, 0.8)'
        };
      case 'transparent':
        return {
          fill: id.startsWith('rgba') ? 'rgba(56, 189, 248, 0.15)' : 'rgba(251, 191, 36, 0.15)',
          stroke: isActive ? (isLight ? '#4f46e5' : '#FFFFFF') : id.startsWith('rgba') ? '#0284C7' : '#D97706',
          strokeWidth: isActive ? (isSingle ? 3.5 : 2.5) : 1.5,
          glow: id.startsWith('rgba') ? 'rgba(56, 189, 248, 0.8)' : 'rgba(251, 191, 36, 0.8)'
        };
      default:
        return {
          fill: '#9CA3AF',
          stroke: '#4B5563',
          strokeWidth: 1,
          glow: 'none'
        };
    }
  };

  // Helper to draw connecting cord/chain
  const drawChain = (cx: number) => {
    if (cx < 0) return null;
    
    // 1. Loop chain
    let dPath = `M ${cx} ${cy + ry}`;
    for (let idx = 7; idx <= 60; idx++) {
      const coords = getLoopCoordinates(cx, idx);
      dPath += ` L ${coords.x} ${coords.y}`;
    }
    dPath += ` Z`;

    return (
      <g>
        {/* Shadow for depth */}
        <path
          d={dPath}
          fill="none"
          stroke={isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(0, 0, 0, 0.5)"}
          strokeWidth={isSingle ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Main string */}
        <path
          d={dPath}
          fill="none"
          stroke={isLight ? "#cbd5e1" : "#4B5563"}
          strokeWidth={isSingle ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2,3"
        />
        {/* Straight chain descending from connector (6) to Cross (0) */}
        <line
          x1={cx}
          y1={cy + ry}
          x2={cx}
          y2={crossY}
          stroke={isLight ? "#cbd5e1" : "#4B5563"}
          strokeWidth={isSingle ? 2 : 1.5}
          strokeDasharray="2,2"
        />
        {/* Center chain connecting Chalice in the middle to the bottom of the loop */}
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy + ry}
          stroke={isLight ? "#cbd5e1" : "#4B5563"}
          strokeWidth={isSingle ? 2 : 1.5}
          strokeDasharray="2,2"
        />
      </g>
    );
  };

  // Helper to determine letter on a large separator bead
  const getSeparatorLetter = (id: string) => {
    if (id.includes('rgba-sep1')) return 'L/R';
    if (id.includes('rgba-sep2')) return 'O/G';
    if (id.includes('rgba-sep3')) return 'V/B';
    if (id.includes('rgba-sep4')) return 'E/A';
    if (id.includes('cmyk-sep1')) return 'H/C';
    if (id.includes('cmyk-sep2')) return 'A/M';
    if (id.includes('cmyk-sep3')) return 'T/Y';
    if (id.includes('cmyk-sep4')) return 'E/K';
    return null;
  };

  // Render a specific bead
  const renderBead = (cx: number, bead: BeadData, activeId: string) => {
    if (cx < 0) return null;
    
    const isActive = bead.id === activeId;
    const coords = getBeadCoords(cx, bead);
    const style = getBeadColorStyle(bead.colorType, isActive, bead.id);
    const letter = getSeparatorLetter(bead.id);

    // Skip rendering cross and connector as standard circles
    if (bead.type === 'cross' || bead.type === 'connector') {
      return null;
    }

    // Adjust radius based on bead type (magnified on single mobile view)
    let r = isSingle ? 10.5 : 7.5;
    if (bead.type === 'decade-separator') r = isSingle ? 16 : 11;
    if (bead.type === 'intro-father') r = isSingle ? 12.5 : 8.5;
    if (isActive) r += isSingle ? 4.5 : 3.5;

    return (
      <g 
        key={bead.id} 
        className="transition-all duration-300"
        onClick={() => onBeadClick && onBeadClick(bead.id)}
      >
        {/* Pulsing glow under active bead */}
        {isActive && (
          <circle
            cx={coords.x}
            cy={coords.y}
            r={r + (isSingle ? 12 : 8)}
            fill="none"
            stroke={style.glow}
            strokeWidth={isSingle ? 3 : 2}
            className="animate-ping"
            opacity={0.6}
          />
        )}
        {isActive && (
          <circle
            cx={coords.x}
            cy={coords.y}
            r={r + (isSingle ? 7 : 4)}
            fill={style.glow}
            opacity={0.3}
            filter="url(#blur-filter)"
          />
        )}
        {/* Main bead body */}
        <circle
          cx={coords.x}
          cy={coords.y}
          r={r}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          className="cursor-pointer hover:scale-125 active:scale-90 transition-transform duration-200"
        />
        {/* Letter inside separator bead */}
        {letter && (
          <text
            x={coords.x}
            y={coords.y + (isSingle ? 3.5 : 2.5)}
            fontFamily="monospace, system-ui, sans-serif"
            fontSize={isActive ? (isSingle ? "11px" : "9px") : (isSingle ? "9px" : "7px")}
            fontWeight="900"
            fill={bead.id.startsWith('rgba') ? '#38BDF8' : '#FBBF24'}
            textAnchor="middle"
            className="select-none pointer-events-none tracking-tighter"
          >
            {letter}
          </text>
        )}
      </g>
    );
  };

  // Render detailed Cross
  const renderCross = (cx: number, isRgba: boolean, isActive: boolean) => {
    if (cx < 0) return null;
    
    const x = cx;
    const y = crossY;
    const width = isSingle ? 38 : 28;
    const height = isSingle ? 58 : 44;
    const activeColor = isRgba ? '#38BDF8' : '#FBBF24';

    return (
      <g 
        key={isRgba ? 'rgba-cross-g' : 'cmyk-cross-g'} 
        className="transition-all duration-300"
        onClick={() => onBeadClick && onBeadClick(isRgba ? 'rgba-cross' : 'cmyk-cross')}
      >
        {isActive && (
          <g>
            <rect
              x={x - width / 2 - 8}
              y={y - 8}
              width={width + 16}
              height={height + 16}
              rx={8}
              fill="none"
              stroke={activeColor}
              strokeWidth={2.5}
              className="animate-pulse"
            />
            <rect
              x={x - width / 2 - 5}
              y={y - 5}
              width={width + 10}
              height={height + 10}
              rx={6}
              fill={isRgba ? 'rgba(255,255,255,0.1)' : 'rgba(251,191,36,0.1)'}
              filter="url(#blur-filter)"
            />
          </g>
        )}
        {/* The Cross design */}
        <g className="cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-150">
          <rect
            x={x - (isSingle ? 6 : 4)}
            y={y}
            width={isSingle ? 12 : 8}
            height={height}
            rx={2}
            fill={isRgba ? 'url(#cross-grad-silver)' : 'url(#cross-grad-charcoal)'}
            stroke={isActive ? activeColor : isRgba ? '#E5E7EB' : '#1F2937'}
            strokeWidth={1.5}
          />
          <rect
            x={x - width / 2}
            y={y + (isSingle ? 16 : 12)}
            width={width}
            height={isSingle ? 11 : 8}
            rx={2}
            fill={isRgba ? 'url(#cross-grad-silver)' : 'url(#cross-grad-charcoal)'}
            stroke={isActive ? activeColor : isRgba ? '#E5E7EB' : '#1F2937'}
            strokeWidth={1.5}
          />
          {/* Inner details */}
          <circle
            cx={x}
            cy={y + (isSingle ? 21 : 16)}
            r={isSingle ? 4 : 3}
            fill={isRgba ? '#FFFFFF' : '#EF4444'}
            opacity={0.8}
          />
        </g>
      </g>
    );
  };

  // Render Connector (Chalice with Host)
  const renderConnector = (cx: number, isRgba: boolean, isActive: boolean) => {
    if (cx < 0) return null;
    
    const x = cx;
    const y = cy;
    const activeColor = isRgba ? '#38BDF8' : '#FBBF24';
    const scale = isSingle ? 2.5 : 2.0;

    return (
      <g 
        key={isRgba ? 'rgba-connector-g' : 'cmyk-connector-g'} 
        className="transition-all duration-300"
        onClick={() => onBeadClick && onBeadClick(isRgba ? 'rgba-connector' : 'cmyk-connector')}
      >
        {isActive && (
          <g>
            <circle
              cx={x}
              cy={y + 2}
              r={isSingle ? 54 : 44}
              fill="none"
              stroke={activeColor}
              strokeWidth={2.5}
              className="animate-pulse"
            />
          </g>
        )}
        {/* Detailed Chalice & Host */}
        <g 
          style={{ transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: 'center' }}
          className="cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-150"
        >
          {/* Eucharistic Host */}
          <circle
            cx={0}
            cy={-12}
            r={10}
            fill="#FFFBEB"
            stroke={isRgba ? '#D1D5DB' : '#FBBF24'}
            strokeWidth={1}
            filter="url(#shadow-host)"
          />
          {/* IHS text inside Host */}
          <text
            x={0}
            y={-10}
            fontFamily="sans-serif"
            fontSize="7px"
            fontWeight="bold"
            fill={isRgba ? '#9CA3AF' : '#D97706'}
            textAnchor="middle"
          >
            IHS
          </text>
          
          {/* Chalice Stem & Cup */}
          <path
            d={`M -10 -2 
               C -10 10, 10 10, 10 -2 
               L 6 -2
               C 3 6, 2 12, 4 14
               L -4 14
               C -2 12, -3 6, -6 -2
               Z`}
            fill={isRgba ? 'url(#grad-silver)' : 'url(#grad-gold)'}
            stroke={isRgba ? '#9CA3AF' : '#D97706'}
            strokeWidth={1}
          />
          {/* Base */}
          <ellipse
            cx={0}
            cy={15}
            rx={8}
            ry={3}
            fill={isRgba ? 'url(#grad-silver)' : 'url(#grad-gold)'}
            stroke={isRgba ? '#9CA3AF' : '#D97706'}
            strokeWidth={1}
          />
        </g>
      </g>
    );
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-2.5 sm:p-4 rounded-3xl relative transition-all duration-300 ${
      isLight ? 'bg-transparent text-slate-950' : 'bg-zinc-950/50 border border-zinc-800/50 shadow-2xl'
    }`}>
      
      {/* SEGMENTED SELECTOR CONTROL FOR TOUCH/MOBILE OPTIMIZATION */}
      <div id="rosary-system-selector" className={`flex w-full max-w-md p-1.5 rounded-2xl border mb-5 relative z-30 transition-all duration-300 ${
        isLight 
          ? 'bg-slate-100 border-slate-200' 
          : 'bg-slate-900/80 border-slate-800/80'
      }`}>
        <button
          id="btn-select-rgba"
          onClick={() => setViewMode('rgba')}
          className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-extrabold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            viewMode === 'rgba'
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-950/40 border border-sky-500/30'
              : isLight 
                ? 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
          RÓŻANIEC HISTORII ZBAWIENIA
        </button>
        <button
          id="btn-select-cmyk"
          onClick={() => setViewMode('cmyk')}
          className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-extrabold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            viewMode === 'cmyk'
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-950/40 border border-amber-500/30'
              : isLight 
                ? 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
          POKUTA I ZADOŚĆUCZYNIENIE
        </button>
        <button
          id="btn-select-both"
          onClick={() => setViewMode('both')}
          className={`hidden md:flex flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-extrabold tracking-wide transition-all cursor-pointer items-center justify-center gap-1.5 ${
            viewMode === 'both'
              ? isLight
                ? 'bg-white text-slate-950 border border-slate-250 shadow-md'
                : 'bg-slate-800 text-white border border-slate-750 shadow-md'
              : isLight 
                ? 'text-slate-600 hover:text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          PEŁNA WIZUALIZACJA
        </button>
      </div>

      <div className="w-full overflow-hidden flex items-center justify-center">
        <svg
          id="rosary-canvas-svg"
          viewBox="0 0 1000 660"
          className="w-full h-auto max-h-[580px] drop-shadow-2xl transition-all duration-500 ease-in-out"
        >
          <defs>
            {/* Filters */}
            <filter id="blur-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
            </filter>
            <filter id="shadow-host" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.3"/>
            </filter>

            {/* Color Gradients */}
            <radialGradient id="grad-white" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#E5E7EB" />
              <stop offset="100%" stopColor="#9CA3AF" />
            </radialGradient>

            <radialGradient id="grad-black" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#374151" />
              <stop offset="70%" stopColor="#111827" />
              <stop offset="100%" stopColor="#030712" />
            </radialGradient>

            <radialGradient id="grad-red" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FCA5A5" />
              <stop offset="60%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#991B1B" />
            </radialGradient>

            <radialGradient id="grad-green" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#86EFAC" />
              <stop offset="60%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#166534" />
            </radialGradient>

            <radialGradient id="grad-blue" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#93C5FD" />
              <stop offset="60%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1E40AF" />
            </radialGradient>

            <radialGradient id="grad-cyan" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="60%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#155E75" />
            </radialGradient>

            <radialGradient id="grad-magenta" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#F5D0FE" />
              <stop offset="60%" stopColor="#D946EF" />
              <stop offset="100%" stopColor="#86198F" />
            </radialGradient>

            <radialGradient id="grad-yellow" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="60%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#854D0E" />
            </radialGradient>

            {/* Metal Gradients */}
            <linearGradient id="grad-silver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#E5E7EB" />
              <stop offset="70%" stopColor="#9CA3AF" />
              <stop offset="100%" stopColor="#4B5563" />
            </linearGradient>

            <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="80%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>

            <linearGradient id="cross-grad-silver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#D1D5DB" />
              <stop offset="100%" stopColor="#9CA3AF" />
            </linearGradient>

            <linearGradient id="cross-grad-charcoal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4B5563" />
              <stop offset="60%" stopColor="#1F2937" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>
          </defs>

          {/* --- LEFT SIDE: RGBA ROSARY --- */}
          {cxRgba > 0 && (
            <g>
              <text
                x={cxRgba}
                y={40}
                fontFamily="system-ui"
                fontSize={isSingle ? "24px" : "20px"}
                fontWeight="900"
                letterSpacing="0.1em"
                fill={isLight ? "#0f172a" : "#FFFFFF"}
                textAnchor="middle"
                opacity={0.9}
              >
                RÓŻANIEC HISTORII ZBAWIENIA
              </text>
              <text
                x={cxRgba}
                y={62}
                fontFamily="monospace"
                fontSize={isSingle ? "12px" : "11px"}
                fill={isLight ? "#0284c7" : "#38BDF8"}
                textAnchor="middle"
                opacity={0.7}
              >
                [RHZ365]
              </text>

              {/* Draw RGBA chains */}
              {drawChain(cxRgba)}

              {/* Draw RGBA beads */}
              {rgbaBeads.map(bead => renderBead(cxRgba, bead, activeRgbaId))}
              
              {/* Draw Connector */}
              {renderConnector(cxRgba, true, activeRgbaId === 'rgba-connector')}
              
              {/* Draw Cross */}
              {renderCross(cxRgba, true, activeRgbaId === 'rgba-cross')}
            </g>
          )}

          {/* --- RIGHT SIDE: CMYK ROSARY --- */}
          {cxCmyk > 0 && (
            <g>
              <text
                x={cxCmyk}
                y={40}
                fontFamily="system-ui"
                fontSize={isSingle ? "24px" : "20px"}
                fontWeight="900"
                letterSpacing="0.1em"
                fill={isLight ? "#0f172a" : "#FFFFFF"}
                textAnchor="middle"
                opacity={0.9}
              >
                RÓŻANIEC CMYK
              </text>
              <text
                x={cxCmyk}
                y={62}
                fontFamily="monospace"
                fontSize={isSingle ? "12px" : "11px"}
                fill={isLight ? "#b45309" : "#FBBF24"}
                textAnchor="middle"
                opacity={0.7}
              >
                [Subtractive Color Model - Pigment]
              </text>

              {/* Draw CMYK chains */}
              {drawChain(cxCmyk)}

              {/* Draw CMYK beads */}
              {cmykBeads.map(bead => renderBead(cxCmyk, bead, activeCmykId))}
              
              {/* Draw Connector */}
              {renderConnector(cxCmyk, false, activeCmykId === 'cmyk-connector')}
              
              {/* Draw Cross */}
              {renderCross(cxCmyk, false, activeCmykId === 'cmyk-cross')}
            </g>
          )}

          {/* Decorative divider line in center (only when displaying both) */}
          {viewMode === 'both' && (
            <line
              x1={500}
              y1={80}
              x2={500}
              y2={620}
              stroke={isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)"}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          )}
        </svg>
      </div>

      <div className={`mt-2 text-center text-[11px] sm:text-xs transition-colors duration-300 ${
        isLight ? 'text-slate-600' : 'text-slate-500'
      }`}>
        💡 <span className={isLight ? 'text-slate-800 font-bold' : 'text-slate-400 font-medium'}>Wskazówka:</span> Możesz kliknąć na dowolny paciorek powyżej, aby od razu przejść do odpowiedniej modlitwy.
      </div>
    </div>
  );
};
