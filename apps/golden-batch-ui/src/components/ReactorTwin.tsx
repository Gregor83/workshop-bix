import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface ReactorTwinProps {
  data: any; // Current data point
  isAnomalous: boolean;
  variables: any[]; // List of current anomalies
}

export const ReactorTwin: React.FC<ReactorTwinProps> = ({ data, isAnomalous, variables }) => {
  // Normalize some values for animation
  // Support both direct keys and the suffixed keys from plotData
  const temp = data?.temp_C ?? data?.temp_C_batch ?? data?.temp_C_raw_batch ?? 0;
  const pressure = data?.pressure_bar ?? data?.pressure_bar_batch ?? data?.pressure_bar_raw_batch ?? 0;
  const rpm = data?.agitator_rpm ?? data?.agitator_rpm_batch ?? data?.agitator_rpm_raw_batch ?? 0;
  const ph = data?.pH ?? data?.pH_batch ?? data?.pH_raw_batch ?? 7;
  
  // Color based on temperature
  const tempColor = useMemo(() => {
    if (temp < 40) return '#60a5fa'; // Blue
    if (temp < 70) return '#fbbf24'; // Yellow
    return '#f87171'; // Red
  }, [temp]);

  // Agitator speed
  const rotationDuration = useMemo(() => {
    if (rpm <= 0) return 0;
    return Math.max(0.2, 10 / (rpm / 100)); // Faster RPM = shorter duration
  }, [rpm]);

  // Check if specific sensors are failing
  const isTempAnomalous = variables.some(v => v.variable === 'temp_C');
  const isPressureAnomalous = variables.some(v => v.variable === 'pressure_bar');
  const isPhAnomalous = variables.some(v => v.variable === 'pH');

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
      {/* Background Glow for Anomaly */}
      <AnimatePresence>
        {isAnomalous && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-rose-500/20 blur-[100px] rounded-full"
          />
        )}
      </AnimatePresence>

      <motion.svg 
        viewBox="0 0 200 300" 
        className="w-full max-w-[280px] drop-shadow-2xl"
        animate={isPressureAnomalous ? {
          x: [0, -1, 1, -1, 1, 0],
          y: [0, 1, -1, 1, -1, 0]
        } : {}}
        transition={isPressureAnomalous ? {
          duration: 0.1,
          repeat: Infinity
        } : {}}
      >
        <defs>
          <linearGradient id="reactorBody" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="50%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
          
          <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={tempColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor={tempColor} stopOpacity="0.4" />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Outer Shell / Jacket */}
        <path 
          d="M40,60 L160,60 L160,220 C160,250 140,270 100,270 C60,270 40,250 40,220 Z" 
          fill="url(#reactorBody)"
          stroke="#52525b"
          strokeWidth="2"
        />

        {/* Liquid Level */}
        <motion.path 
          d="M45,100 L155,100 L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z" 
          fill="url(#liquidGrad)"
          animate={{
            d: [
              "M45,105 L155,105 L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z",
              "M45,103 L155,107 L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z",
              "M45,105 L155,105 L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z"
            ]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Agitator Shaft */}
        <line x1="100" y1="30" x2="100" y2="220" stroke="#a1a1aa" strokeWidth="4" />
        
        {/* Agitator Blades */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: rotationDuration, repeat: Infinity, ease: "linear" }}
          style={{ originX: '100px', originY: '220px' }}
        >
          <rect x="70" y="215" width="60" height="10" rx="2" fill="#d4d4d8" />
          <rect x="95" y="200" width="10" height="40" rx="2" fill="#d4d4d8" />
        </motion.g>

        {/* Top Cover */}
        <path d="M35,60 C35,30 165,30 165,60 Z" fill="#3f3f46" stroke="#52525b" strokeWidth="2" />
        
        {/* Sensors & Pipes */}
        <rect x="60" y="20" width="8" height="40" fill="#27272a" stroke="#52525b" />
        <rect x="130" y="20" width="8" height="40" fill="#27272a" stroke="#52525b" />
        
        {/* Pressure Gauge */}
        <g transform="translate(145, 50)">
          <circle r="15" fill="#18181b" stroke={isPressureAnomalous ? "#f43f5e" : "#52525b"} strokeWidth="2" />
          <motion.line 
            x1="0" y1="0" x2="0" y2="-10" 
            stroke={isPressureAnomalous ? "#f43f5e" : "#ffffff"} 
            strokeWidth="2" 
            animate={{ rotate: (pressure * 20) - 90 }}
            transition={{ type: 'spring', stiffness: 50 }}
          />
        </g>

        {/* Temperature indicator glow */}
        <circle cx="100" cy="180" r="30" fill={tempColor} fillOpacity="0.1" filter="url(#glow)" />

        {/* Anomalous sensor indicators */}
        {isTempAnomalous && (
          <motion.circle 
            cx="100" cy="180" r="40" 
            stroke="#f43f5e" strokeWidth="2" fill="none" strokeDasharray="4 4"
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.svg>

      {/* Live Stats Overlay */}
      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2">
        <div className={cn(
          "bg-zinc-900/80 backdrop-blur border p-2 rounded-lg text-[10px]",
          isTempAnomalous ? "border-rose-500/50 text-rose-400" : "border-zinc-800 text-zinc-400"
        )}>
          <div className="uppercase opacity-50 font-bold">Temperatur</div>
          <div className="text-sm font-mono text-zinc-100">{temp.toFixed(1)}°C</div>
        </div>
        <div className={cn(
          "bg-zinc-900/80 backdrop-blur border p-2 rounded-lg text-[10px]",
          isPressureAnomalous ? "border-rose-500/50 text-rose-400" : "border-zinc-800 text-zinc-400"
        )}>
          <div className="uppercase opacity-50 font-bold">Druck</div>
          <div className="text-sm font-mono text-zinc-100">{pressure.toFixed(2)} bar</div>
        </div>
        <div className={cn(
          "bg-zinc-900/80 backdrop-blur border p-2 rounded-lg text-[10px]",
          isPhAnomalous ? "border-rose-500/50 text-rose-400" : "border-zinc-800 text-zinc-400"
        )}>
          <div className="uppercase opacity-50 font-bold">pH-Wert</div>
          <div className="text-sm font-mono text-zinc-100">{ph.toFixed(2)}</div>
        </div>
        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 p-2 rounded-lg text-[10px] text-zinc-400">
          <div className="uppercase opacity-50 font-bold">Rührwerk</div>
          <div className="text-sm font-mono text-zinc-100">{rpm.toFixed(0)} RPM</div>
        </div>
      </div>
    </div>
  );
};
