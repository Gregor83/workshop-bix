import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Thermometer, Gauge, Droplets, RotateCw, ArrowDownToLine } from 'lucide-react';

interface ReactorTwinProps {
  data: any; // Current data point
  isAnomalous: boolean;
  variables: any[]; // List of current anomalies
}

export const ReactorTwin: React.FC<ReactorTwinProps> = ({ data, isAnomalous, variables }) => {
  // Normalize some values for animation
  const temp = data?.temp_C ?? data?.temp_C_batch ?? data?.temp_C_raw_batch ?? 0;
  const pressure = data?.pressure_bar ?? data?.pressure_bar_batch ?? data?.pressure_bar_raw_batch ?? 0;
  const rpm = data?.agitator_rpm ?? data?.agitator_rpm_batch ?? data?.agitator_rpm_raw_batch ?? 0;
  const ph = data?.pH ?? data?.pH_batch ?? data?.pH_raw_batch ?? 7;
  const feedA = data?.feed_A_Lph ?? data?.feed_A_Lph_batch ?? data?.feed_A_Lph_raw_batch ?? 0;
  const feedB = data?.feed_B_Lph ?? data?.feed_B_Lph_batch ?? data?.feed_B_Lph_raw_batch ?? 0;
  
  // Color based on temperature
  const tempColor = useMemo(() => {
    if (temp < 40) return '#60a5fa'; // Blue
    if (temp < 70) return '#fbbf24'; // Yellow
    return '#f43f5e'; // Rose/Red
  }, [temp]);

  // Agitator speed
  const rotationDuration = useMemo(() => {
    if (rpm <= 0) return 0;
    return Math.max(0.1, 10 / (rpm / 100)); // Faster RPM = shorter duration
  }, [rpm]);

  // Check if specific sensors are failing
  const isTempAnomalous = variables.some(v => v.variable === 'temp_C');
  const isPressureAnomalous = variables.some(v => v.variable === 'pressure_bar');
  const isPhAnomalous = variables.some(v => v.variable === 'pH');
  const isRpmAnomalous = variables.some(v => v.variable === 'agitator_rpm');
  const isFeedAAnomalous = variables.some(v => v.variable === 'feed_A_Lph');
  const isFeedBAnomalous = variables.some(v => v.variable === 'feed_B_Lph');

  return (
    <div className="relative w-full h-full flex flex-col lg:flex-row items-center justify-center p-6 gap-8 overflow-hidden bg-zinc-950/20">
      
      {/* LEFT PANEL: Live Stats "Buttons" */}
      <div className="flex flex-col gap-3 w-full lg:w-48 z-20 overflow-y-auto max-h-full pr-2 custom-scrollbar">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 border-b border-zinc-800 pb-1 sticky top-0 bg-zinc-950/20 backdrop-blur-sm z-10">Sensorik</h3>
        
        {/* Row 1: Temp & Pressure */}
        <div className="grid grid-cols-1 gap-3">
          <div className={cn(
            "group relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border p-3 rounded-xl transition-all duration-300",
            isTempAnomalous ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className={cn("w-3 h-3", isTempAnomalous ? "text-rose-400" : "text-zinc-500")} />
              <div className="uppercase text-[9px] font-bold text-zinc-500 tracking-wider">Temperatur</div>
            </div>
            <div className="text-lg font-mono font-bold text-white">{temp.toFixed(1)}<span className="text-[10px] ml-1 opacity-50">°C</span></div>
            {isTempAnomalous && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </div>

          <div className={cn(
            "group relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border p-3 rounded-xl transition-all duration-300",
            isPressureAnomalous ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Gauge className={cn("w-3 h-3", isPressureAnomalous ? "text-rose-400" : "text-zinc-500")} />
              <div className="uppercase text-[9px] font-bold text-zinc-500 tracking-wider">Druck</div>
            </div>
            <div className="text-lg font-mono font-bold text-white">{pressure.toFixed(2)}<span className="text-[10px] ml-1 opacity-50">bar</span></div>
            {isPressureAnomalous && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </div>
        </div>

        {/* Row 2: pH & RPM */}
        <div className="grid grid-cols-1 gap-3">
          <div className={cn(
            "group relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border p-3 rounded-xl transition-all duration-300",
            isPhAnomalous ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Droplets className={cn("w-3 h-3", isPhAnomalous ? "text-rose-400" : "text-zinc-500")} />
              <div className="uppercase text-[9px] font-bold text-zinc-500 tracking-wider">pH-Wert</div>
            </div>
            <div className="text-lg font-mono font-bold text-white">{ph.toFixed(2)}</div>
            {isPhAnomalous && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </div>

          <div className={cn(
            "group relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border p-3 rounded-xl transition-all duration-300",
            isRpmAnomalous ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <RotateCw className={cn("w-3 h-3", isRpmAnomalous ? "text-rose-400" : "text-zinc-500")} />
              <div className="uppercase text-[9px] font-bold text-zinc-500 tracking-wider">Rührwerk</div>
            </div>
            <div className="text-lg font-mono font-bold text-white">{rpm.toFixed(0)}<span className="text-[10px] ml-1 opacity-50">RPM</span></div>
            {isRpmAnomalous && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </div>
        </div>

        {/* Row 3: Feeds (Zuläufe) */}
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-4 mb-2 border-b border-zinc-800 pb-1">Zuläufe</h3>
        <div className="grid grid-cols-1 gap-3">
          <div className={cn(
            "group relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border p-3 rounded-xl transition-all duration-300",
            isFeedAAnomalous ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownToLine className={cn("w-3 h-3", isFeedAAnomalous ? "text-rose-400" : "text-zinc-500")} />
              <div className="uppercase text-[9px] font-bold text-zinc-500 tracking-wider">Zulauf A</div>
            </div>
            <div className="text-lg font-mono font-bold text-white">{feedA.toFixed(1)}<span className="text-[10px] ml-1 opacity-50">L/h</span></div>
            {feedA > 0 && <motion.div animate={{ height: ['0%', '100%'], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute left-0 top-0 w-1 bg-emerald-500/50" />}
          </div>

          <div className={cn(
            "group relative overflow-hidden bg-zinc-900/60 backdrop-blur-md border p-3 rounded-xl transition-all duration-300",
            isFeedBAnomalous ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownToLine className={cn("w-3 h-3", isFeedBAnomalous ? "text-rose-400" : "text-zinc-500")} />
              <div className="uppercase text-[9px] font-bold text-zinc-500 tracking-wider">Zulauf B</div>
            </div>
            <div className="text-lg font-mono font-bold text-white">{feedB.toFixed(1)}<span className="text-[10px] ml-1 opacity-50">L/h</span></div>
            {feedB > 0 && <motion.div animate={{ height: ['0%', '100%'], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute left-0 top-0 w-1 bg-emerald-500/50" />}
          </div>
        </div>
      </div>

      {/* CENTER/RIGHT: The Reactor Visual */}
      <div className="relative flex-1 flex items-center justify-center min-h-[400px]">
        {/* Background Glow for Anomaly */}
        <AnimatePresence>
          {isAnomalous && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.1, 0.4, 0.1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-rose-600/30 blur-[120px] rounded-full"
            />
          )}
        </AnimatePresence>

        {/* Dynamic Steam/Smoke Particles when hot or anomalous */}
        {(temp > 80 || isTempAnomalous) && (
          <div className="absolute top-0 w-full flex justify-center h-40 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: 100, x: Math.random() * 60 - 30, opacity: 0, scale: 0.5 }}
                animate={{ y: -50, x: Math.random() * 100 - 50, opacity: [0, 0.5, 0], scale: [0.5, 2, 3] }}
                transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: i * 0.5 }}
                className="absolute w-8 h-8 bg-zinc-200/20 blur-xl rounded-full"
              />
            ))}
          </div>
        )}

        <motion.svg 
          viewBox="0 0 200 300" 
          className="w-full max-w-[320px] h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          animate={(isPressureAnomalous || pressure > 2.5) ? {
            x: [0, -2, 2, -2, 2, 0],
            y: [0, 2, -2, 2, -2, 0],
            rotate: [0, -0.5, 0.5, -0.5, 0.5, 0]
          } : {}}
          transition={(isPressureAnomalous || pressure > 2.5) ? {
            duration: 0.08,
            repeat: Infinity
          } : {}}
        >
          <defs>
            <linearGradient id="reactorBody" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#18181b" />
              <stop offset="50%" stopColor="#3f3f46" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
            
            <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={tempColor} stopOpacity="0.9" />
              <stop offset="100%" stopColor={tempColor} stopOpacity="0.4" />
            </linearGradient>

            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <filter id="spark">
               <feGaussianBlur stdDeviation="1.5" result="blur" />
               <feColorMatrix type="matrix" values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" />
            </filter>
          </defs>

          {/* Reactor Stand / Feet */}
          <rect x="50" y="270" width="10" height="20" fill="#18181b" />
          <rect x="140" y="270" width="10" height="20" fill="#18181b" />

          {/* Outer Shell / Jacket */}
          <path 
            d="M40,60 L160,60 L160,220 C160,250 140,270 100,270 C60,270 40,250 40,220 Z" 
            fill="url(#reactorBody)"
            stroke="#52525b"
            strokeWidth="2.5"
          />

          {/* Internal Chamber Shadow */}
          <path 
            d="M45,65 L155,65 L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z" 
            fill="#09090b"
          />

          {/* Liquid Level with Surface Waves */}
          <motion.path 
            d="M45,100 L155,100 L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z" 
            fill="url(#liquidGrad)"
            animate={{
              d: [
                `M45,${110 - (rpm/20)} Q100,${105 - (rpm/10)} 155,${110 - (rpm/20)} L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z`,
                `M45,${110 - (rpm/20)} Q100,${115 - (rpm/10)} 155,${110 - (rpm/20)} L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z`,
                `M45,${110 - (rpm/20)} Q100,${105 - (rpm/10)} 155,${110 - (rpm/20)} L155,220 C155,245 135,265 100,265 C65,265 45,245 45,220 Z`
              ]
            }}
            transition={{ duration: Math.max(0.5, 3 - (rpm/50)), repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Bubbles when agitator is fast */}
          {rpm > 50 && [...Array(8)].map((_, i) => (
             <motion.circle
               key={i}
               r={Math.random() * 3 + 1}
               fill="#ffffff"
               fillOpacity="0.2"
               animate={{
                 cx: [100 + (Math.random() * 80 - 40), 100 + (Math.random() * 80 - 40)],
                 cy: [240, 120],
                 opacity: [0, 0.4, 0]
               }}
               transition={{ duration: 1.5 + Math.random(), repeat: Infinity, delay: i * 0.3 }}
             />
          ))}

          {/* Agitator Shaft */}
          <line x1="100" y1="30" x2="100" y2="220" stroke="#a1a1aa" strokeWidth="5" />
          
          {/* Agitator Blades */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: rotationDuration, repeat: Infinity, ease: "linear" }}
            style={{ originX: '100px', originY: '220px' }}
          >
            <rect x="65" y="212" width="70" height="12" rx="3" fill="#d4d4d8" />
            <rect x="94" y="195" width="12" height="45" rx="3" fill="#d4d4d8" />
            {/* Blade highlight */}
            <rect x="68" y="214" width="20" height="2" fill="#ffffff" fillOpacity="0.3" />
          </motion.g>

          {/* Top Cover */}
          <path d="M35,60 C35,20 165,20 165,60 Z" fill="#27272a" stroke="#52525b" strokeWidth="2.5" />
          
          {/* Pipes with flow indicators */}
          <g>
            <rect x="60" y="10" width="12" height="50" fill="#18181b" stroke={isFeedAAnomalous ? "#f43f5e" : "#3f3f46"} />
            {feedA > 0 && (
              <motion.rect 
                x="64" y="10" width="4" height="40" fill="#3b82f6" fillOpacity="0.6"
                animate={{ y: [10, 50], height: [0, 20, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
            <rect x="128" y="10" width="12" height="50" fill="#18181b" stroke={isFeedBAnomalous ? "#f43f5e" : "#3f3f46"} />
            {feedB > 0 && (
              <motion.rect 
                x="132" y="10" width="4" height="40" fill="#3b82f6" fillOpacity="0.6"
                animate={{ y: [10, 50], height: [0, 20, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
              />
            )}
          </g>
          
          {/* Pressure Gauge */}
          <g transform="translate(145, 50)">
            <circle r="18" fill="#09090b" stroke={isPressureAnomalous ? "#f43f5e" : "#52525b"} strokeWidth="2.5" />
            <circle r="14" fill="#18181b" />
            <motion.line 
              x1="0" y1="0" x2="0" y2="-12" 
              stroke={isPressureAnomalous ? "#f43f5e" : "#ffffff"} 
              strokeWidth="2.5" 
              animate={{ rotate: (pressure * 30) - 120 }}
              transition={{ type: 'spring', stiffness: 50 }}
            />
            {/* Digital Pressure Indicator */}
            <circle r="2" cx="0" cy="0" fill={isPressureAnomalous ? "#f43f5e" : "#3b82f6"} />
          </g>

          {/* Temperature sensor indicator with "pulse" effect */}
          <circle cx="100" cy="180" r="25" fill={tempColor} fillOpacity="0.15" filter="url(#glow)" />
          
          {/* Anomaly Spark Effects */}
          {isAnomalous && [...Array(3)].map((_, i) => (
             <motion.g key={i}>
                <motion.path
                  d={`M ${80 + Math.random() * 40} ${140 + Math.random() * 80} l ${Math.random() * 10 - 5} ${Math.random() * 10 - 5}`}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  filter="url(#spark)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                  transition={{ duration: 0.2, repeat: Infinity, delay: i * 0.7 }}
                />
             </motion.g>
          ))}

          {/* Warning Sign when anomalous */}
          <AnimatePresence>
            {isAnomalous && (
              <motion.g
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transform="translate(100, 140)"
              >
                 <polygon points="0,-15 15,12 -15,12" fill="#f43f5e" />
                 <text y="9" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">!</text>
              </motion.g>
            )}
          </AnimatePresence>
        </motion.svg>

        {/* Status Message */}
        <div className="absolute top-4 right-4 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-xl">
           <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isAnomalous ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                {isAnomalous ? "Systemwarnung" : "System Normal"}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};
