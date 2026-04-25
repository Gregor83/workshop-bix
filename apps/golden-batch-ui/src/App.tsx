import { useEffect, useState, useMemo } from 'react';
import { Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceArea } from 'recharts';
import { loadData, BatchMeta, TimeSeriesRow, GoldenProfilePoint } from './data/parser';
import { cn } from './lib/utils';
import { fetchAIAssessment, AIAssessment } from './lib/ai';
import { AlertTriangle, CheckCircle2, ChevronRight, ActivitySquare, BarChart3, Play, Pause, RotateCcw, Cpu, Info, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactorTwin } from './components/ReactorTwin';
import { useRef } from 'react';

/**
 * Configuration and constants for the Golden Batch Detective.
 */

// Keys of the process variables we are monitoring
const variables = ['temp_C', 'pressure_bar', 'pH', 'agitator_rpm', 'feed_A_Lph', 'feed_B_Lph'] as const;

// Human-readable labels for the process variables
const varNames: Record<string, string> = {
  'temp_C': 'Temperatur',
  'pressure_bar': 'Druck',
  'pH': 'pH-Wert',
  'agitator_rpm': 'Drehzahl',
  'feed_A_Lph': 'Zulauf A',
  'feed_B_Lph': 'Zulauf B'
};

// Mappings for technical root cause labels to human-readable German descriptions
const rootCauseNames: Record<string, string> = {
  'base_pump_calibration': 'Pumpen-Kalibrierung (Lauge)',
  'controller_setpoint_error': 'Sollwert-Fehler (Regler)',
  'none': 'Keine relevanten Fehler',
  'raw_material_viscosity': 'Viskosität d. Rohmaterials',
  'steam_valve_stiction': 'Dampfventil-Blockade',
  'vent_filter_clogging': 'Filter-Verstopfung'
};

// Color mapping for different process phases to be used as background highlights
const phaseColorMap: Record<string, string> = {
  'Charge': '#18181b',
  'HeatUp': '#27272a',
  'React': '#18181b',
  'Hold': '#27272a',
  'CoolDown': '#18181b',
  'Transfer': '#27272a',
  'CIP': '#18181b'
};

/**
 * Custom hook to handle synthesized alarm sounds using Web Audio API.
 */
function useAlarmSound() {
  const audioCtx = useRef<AudioContext | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const isPlaying = useRef(false);

  const startAlarm = () => {
    if (isPlaying.current) return;
    
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }

    gainNode.current = audioCtx.current.createGain();
    gainNode.current.connect(audioCtx.current.destination);
    gainNode.current.gain.setValueAtTime(0, audioCtx.current.currentTime);

    const playBeep = () => {
      if (!isPlaying.current || !audioCtx.current || !gainNode.current) return;
      
      const osc = audioCtx.current.createOscillator();
      osc.type = 'square'; // Industrial sound
      osc.frequency.setValueAtTime(880, audioCtx.current.currentTime); // High pitch
      osc.connect(gainNode.current);
      
      const now = audioCtx.current.currentTime;
      gainNode.current.gain.linearRampToValueAtTime(0.1, now + 0.01);
      gainNode.current.gain.linearRampToValueAtTime(0, now + 0.1);
      
      osc.start(now);
      osc.stop(now + 0.1);
      
      setTimeout(playBeep, 500); // Repeat every 500ms
    };

    isPlaying.current = true;
    playBeep();
  };

  const stopAlarm = () => {
    isPlaying.current = false;
    if (gainNode.current) {
      gainNode.current.gain.setTargetAtTime(0, audioCtx.current?.currentTime || 0, 0.05);
    }
  };

  return { startAlarm, stopAlarm };
}

export default function App() {
  // Global state for batch and time-series data
  const [batches, setBatches] = useState<BatchMeta[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesRow[]>([]);
  const [goldenProfile, setGoldenProfile] = useState<GoldenProfilePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>('A_B003');
  
  // Simulation control state (Playback and Speed)
  const [currentPct, setCurrentPct] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(2000);
  
  // State for AI-driven analysis snapshots
  const [analyzedPct, setAnalyzedPct] = useState<number>(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAssessment, setAiAssessment] = useState<AIAssessment | null>(null);

  // Filter and search state for the batch sidebar
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'normal' | 'anomaly'>('all');

  // View state: 'overview' or 'charts'
  const [activeView, setActiveView] = useState<'overview' | 'charts'>('overview');

  const [dataset, setDataset] = useState<'caseA' | 'caseA_test'>('caseA');

  useEffect(() => {
    setLoading(true);
    loadData(dataset).then(data => {
      setBatches(data.batches);
      setTimeseries(data.timeseries);
      setGoldenProfile(data.goldenProfile);
      
      // Select the first batch of the new dataset automatically
      if (data.batches.length > 0) {
        setSelectedBatchId(data.batches[0].batch_id);
      }
      
      setLoading(false);
    });
  }, [dataset]);

  // Filter batches list
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchSearch = b.batch_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'all' ? true : 
                          filterStatus === 'normal' ? b.is_anomalous === 0 : 
                          filterStatus === 'anomaly' ? b.is_anomalous === 1 :
                          b.is_anomalous === null || b.is_anomalous === undefined;
      return matchSearch && matchStatus;
    });
  }, [batches, searchQuery, filterStatus]);

  // Simulation Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentPct(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 1;
        });
      }, simSpeed); 
    }
    return () => clearInterval(interval);
  }, [isPlaying, simSpeed]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedBatch = useMemo(() => batches.find(b => b.batch_id === selectedBatchId), [batches, selectedBatchId]);
  
  const phaseBoundaries = useMemo(() => {
    if (!goldenProfile.length) return [];
    const boundaries: { phase: string; start: number; end: number }[] = [];
    let currentPhase = goldenProfile[0].phase;
    let startPct = 0;
    
    for (let i = 1; i < goldenProfile.length; i++) {
        if (goldenProfile[i].phase !== currentPhase) {
            boundaries.push({ phase: currentPhase, start: startPct, end: goldenProfile[i - 1].t_pct });
            currentPhase = goldenProfile[i].phase;
            startPct = goldenProfile[i].t_pct;
        }
    }
    if (goldenProfile.length > 0) {
        boundaries.push({ phase: currentPhase, start: startPct, end: goldenProfile[goldenProfile.length - 1].t_pct });
    }
    return boundaries;
  }, [goldenProfile]);

  /**
   * Processes raw data into a format suitable for plotting.
   * Merges the current batch data with the Golden Profile for comparison.
   */
  const rawPlotData = useMemo(() => {
    if (!selectedBatchId || goldenProfile.length === 0) return [];
    const batchData = timeseries.filter(t => t.batch_id === selectedBatchId);
    
    return goldenProfile.map(gp => {
      const match = batchData.find(b => Math.round(b.t_pct) === gp.t_pct);
      const point: any = { t_pct: gp.t_pct, phase: gp.phase };

      variables.forEach(v => {
        // Golden Profile bounds (Mean +/- 2 Sigma)
        point[`${v}_mean`] = gp[v].mean;
        point[`${v}_lower`] = gp[v].mean - gp[v].std * 2.0; 
        point[`${v}_upper`] = gp[v].mean + gp[v].std * 2.0;
        
        // Match current batch values and calculate deviation (Z-Score)
        if (match) {
          point[`${v}_raw_batch`] = match[v];
          point[`${v}_zscore`] = Math.abs((match[v] - gp[v].mean) / (gp[v].std || 1));
        }
      });
      return point;
    });
  }, [timeseries, goldenProfile, selectedBatchId]);

  /**
   * Enriches plot data with visibility logic (simulation progress) and anomaly coloring.
   * Highlights segments as 'normal' or 'anomaly' based on Golden Profile deviation.
   */
  const plotData = useMemo(() => {
    return rawPlotData.map((pt, i, ObjectArray) => {
      const cloned = { ...pt };

      variables.forEach(v => {
        // Data visibility is tied to the current simulation percentage
        const isVisible = cloned.t_pct <= currentPct;
        const val = isVisible ? cloned[`${v}_raw_batch`] : null;
        cloned[`${v}_batch`] = val;

        if (val === null || val === undefined) {
           cloned[`${v}_normal`] = null;
           cloned[`${v}_anomaly`] = null;
           return;
        }

        // Internal helper to determine if a specific point is anomalous
        const isAnom = (index: number) => {
            const tempPoint = ObjectArray[index];
            const tempVal = tempPoint.t_pct <= currentPct ? tempPoint[`${v}_raw_batch`] : null;
            if (tempVal === null || tempVal === undefined) return false;
            return tempVal < tempPoint[`${v}_lower`] || tempVal > tempPoint[`${v}_upper`];
        };

        const currentAnom = isAnom(i);
        const prevAnom = i > 0 ? isAnom(i-1) : false;
        const nextAnom = i < ObjectArray.length - 1 ? isAnom(i+1) : false;

        // Separate points into normal and anomalous series for color-coded rendering
        cloned[`${v}_normal`] = !currentAnom ? val : null;
        cloned[`${v}_anomaly`] = (currentAnom || prevAnom || nextAnom) ? val : null;
      });
      
      return cloned;
    });
  }, [rawPlotData, currentPct]);

  const getDriversForPct = (pct: number) => {
    if (!rawPlotData.length) return [];
    
    const maxZScores: { variable: string; phase: string; maxZ: number; count: number; worstVal?: number; worstExpected?: number }[] = [];
    
    variables.forEach(v => {
      let maxZ = 0;
      let worstPhase = '';
      let anomalyCount = 0;
      let worstVal: number | undefined;
      let worstExpected: number | undefined;
      
      const visibleData = rawPlotData.filter(pt => pt.t_pct <= pct);
      
      visibleData.forEach(pt => {
        if (pt[`${v}_zscore`] !== undefined) {
          const z = pt[`${v}_zscore`];
          if (z > 2.0) anomalyCount++;
          if (z > maxZ) {
            maxZ = z;
            worstPhase = pt.phase;
            worstVal = pt[`${v}_raw_batch`];
            worstExpected = pt[`${v}_mean`];
          }
        }
      });
      
      if (maxZ > 2.0) {
        maxZScores.push({ variable: v, phase: worstPhase, maxZ, count: anomalyCount, worstVal, worstExpected });
      }
    });
    
    return maxZScores.sort((a, b) => b.maxZ - a.maxZ);
  };

  const drivers = useMemo(() => {
    if (analyzedPct < 0) return [];
    return getDriversForPct(analyzedPct);
  }, [rawPlotData, analyzedPct]);

  // Tracks all variables that have shown an anomaly at any point in the current simulation run
  const allAnomaliesSoFar = useMemo(() => {
    if (currentPct === 0 || !rawPlotData.length) return [];
    return getDriversForPct(currentPct);
  }, [rawPlotData, currentPct]);

  // Tracks anomalies specifically at the current point in time
  const liveDrivers = useMemo(() => {
    if (currentPct === 0 || !rawPlotData.length) return [];
    
    // Find closest data point to currentPct
    const currentPoint = rawPlotData.reduce((prev, curr) => 
      Math.abs(curr.t_pct - currentPct) < Math.abs(prev.t_pct - currentPct) ? curr : prev
    );

    if (!currentPoint) return [];
    
    const driversAtPoint: any[] = [];
    variables.forEach(v => {
      const z = currentPoint[`${v}_zscore`];
      if (z !== undefined && z > 2.0) {
        driversAtPoint.push({ variable: v, phase: currentPoint.phase });
      }
    });
    return driversAtPoint;
  }, [rawPlotData, currentPct]);

  const [showLiveWarning, setShowLiveWarning] = useState(false);
  const [warningDrivers, setWarningDrivers] = useState<any[]>([]);
  const { startAlarm, stopAlarm } = useAlarmSound();

  // Warning system logic: Shows a live warning when a new anomaly is occurring
  useEffect(() => {
    if (liveDrivers.length > 0 && isPlaying) {
      setShowLiveWarning(true);
      setWarningDrivers(liveDrivers);
      startAlarm();
    } else {
      setShowLiveWarning(false);
      stopAlarm();
    }
  }, [liveDrivers, isPlaying]);


  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId);
    setCurrentPct(0);
    setAnalyzedPct(-1);
    setIsPlaying(false);
    setAiAssessment(null);
  };

  const handleRunAnalysis = async () => {
    if (!selectedBatchId) return;
    setIsAnalyzing(true);
    setAiAssessment(null);
    setAnalyzedPct(currentPct);
    
    try {
      const currentDrivers = getDriversForPct(currentPct);
      const assessment = await fetchAIAssessment(selectedBatchId, currentPct, currentDrivers, varNames);
      setAiAssessment(assessment);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <ActivitySquare className="w-12 h-12 text-blue-500" />
        </motion.div>
        <span className="ml-4 text-xl font-medium tracking-tight">Initializing Agentic Detective...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900/80 p-4 sticky top-0 backdrop-blur-xl z-[100] w-full">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-8">
          {/* Brand/Logo Section */}
          <div className="flex items-center gap-4 shrink-0">
            <img src="/logo.png" alt="BatchGuard Logo" className="h-12 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
                BatchGuard <span className="text-blue-500">Detective</span>
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Industrial Intelligence</p>
            </div>
          </div>
          
          {/* Main Controls - Center */}
          <div className="flex-1 flex items-center justify-center gap-4 max-w-3xl">
            <div className="flex items-center gap-2 bg-zinc-950/50 border border-zinc-800 p-1.5 rounded-2xl w-full shadow-inner">
              <div className="flex items-center gap-1 border-r border-zinc-800/50 pr-2">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-lg",
                    isPlaying ? "bg-amber-500 text-zinc-950 hover:bg-amber-400" : "bg-blue-600 text-white hover:bg-blue-500"
                  )}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button 
                  onClick={() => { setCurrentPct(0); setAnalyzedPct(-1); setIsPlaying(false); setAiAssessment(null); }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col px-4 gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Simulation Progress</span>
                  <span className="text-[10px] font-bold text-blue-500">{currentPct}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={currentPct} 
                  onChange={(e) => setCurrentPct(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 border-l border-zinc-800/50 pl-2">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-zinc-600 font-bold uppercase mb-0.5">Speed</span>
                  <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                    {[2000, 1000, 500].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setSimSpeed(speed)}
                        className={cn(
                          "px-2 py-1 rounded text-[9px] font-bold transition-all",
                          simSpeed === speed ? "bg-zinc-700 text-white" : "text-zinc-600 hover:text-zinc-400"
                        )}
                      >
                        {speed === 2000 ? '0.05x' : speed === 1000 ? '0.1x' : '0.2x'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration - Right */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex bg-zinc-900/50 border border-zinc-800 rounded-xl p-1">
                <button 
                  onClick={() => setDataset('caseA')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all",
                    dataset === 'caseA' ? "bg-blue-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Reference
                </button>
                <button 
                  onClick={() => setDataset('caseA_test')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all",
                    dataset === 'caseA_test' ? "bg-rose-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Live Test
                </button>
              </div>

              <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                <button 
                  onClick={() => setActiveView('overview')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5",
                    activeView === 'overview' ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <ActivitySquare className="w-3 h-3" /> Dashboard
                </button>
                <button 
                  onClick={() => setActiveView('charts')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5",
                    activeView === 'charts' ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <BarChart3 className="w-3 h-3" /> Charts
                </button>
              </div>
            </div>

            <button 
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || currentPct === 0}
              className={cn(
                "group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all overflow-hidden",
                isAnalyzing ? "bg-zinc-800" : "bg-rose-500 hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_30px_rgba(244,63,94,0.5)]"
              )}
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              {isAnalyzing ? <ActivitySquare className="w-6 h-6 animate-spin text-zinc-500" /> : <Cpu className="w-6 h-6 text-white" />}
              {!isAnalyzing && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-3 h-3 bg-white rounded-full animate-ping opacity-40"></div>
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        <AnimatePresence>
          {showLiveWarning && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
            >
              <div className="bg-rose-600 text-white px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-4 border border-rose-400/50 backdrop-blur-md">
                <div className="relative">
                  <AlertTriangle className="w-6 h-6" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-75"></div>
                </div>
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider leading-none mb-1">Live Anomalie erkannt</div>
                  <div className="text-[10px] font-medium opacity-90 leading-none">
                    Abweichung bei: <span className="font-bold underline">{warningDrivers.map((d: any) => varNames[d.variable]).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(', ')}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 max-h-[85vh] flex-shrink-0">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Batch Auswahl</span>
              <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs">{filteredBatches.length}</span>
            </h2>
            
            <div className="flex flex-col gap-3 pb-2 border-b border-zinc-800">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Batch ID suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFilterStatus('all')}
                  className={cn("flex-1 text-xs py-1.5 rounded-md border transition-colors", filterStatus === 'all' ? "bg-zinc-800 border-zinc-700 text-white" : "border-zinc-800 text-zinc-500 hover:text-zinc-300")}
                >
                  Alle
                </button>
                <button 
                  onClick={() => setFilterStatus('normal')}
                  className={cn("flex-1 text-xs py-1.5 rounded-md border transition-colors", filterStatus === 'normal' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "border-zinc-800 text-zinc-500 hover:text-emerald-400/50")}
                >
                  Normal
                </button>
                <button 
                  onClick={() => setFilterStatus('anomaly')}
                  className={cn("flex-1 text-xs py-1.5 rounded-md border transition-colors", filterStatus === 'anomaly' ? "bg-rose-500/20 border-rose-500/30 text-rose-400" : "border-zinc-800 text-zinc-500 hover:text-rose-400/50")}
                >
                  Anomalie
                </button>
                <button 
                  onClick={() => setFilterStatus('all')} // Or add a specific 'unchecked' filter if needed
                  className="hidden"
                >
                </button>
              </div>
            </div>

            <div className="overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {filteredBatches.length === 0 && (
                <div className="text-center text-zinc-500 text-sm py-4">Keine Batches gefunden.</div>
              )}
              {filteredBatches.map(batch => (
                <button
                  key={batch.batch_id}
                  onClick={() => handleSelectBatch(batch.batch_id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 flex items-center justify-between",
                    selectedBatchId === batch.batch_id 
                      ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20" 
                      : "bg-zinc-800/20 border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700/50"
                  )}
                >
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {batch.batch_id}
                      {batch.is_anomalous === 1 && <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>}
                      {batch.is_anomalous === 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>}
                      {(batch.is_anomalous === null || batch.is_anomalous === undefined || batch.is_anomalous === "") && <span className="w-2 h-2 rounded-full bg-zinc-500 shadow-[0_0_8px_rgba(161,161,170,0.4)]"></span>}
                    </div>
                    <div className="text-xs mt-1 text-zinc-500">
                      Ertrag: {batch.yield_kg.toFixed(0)} kg
                    </div>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-zinc-600 transition-transform", selectedBatchId === batch.batch_id && "text-blue-500 translate-x-1")} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-9 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {activeView === 'overview' ? (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-stretch">
                  {selectedBatch && (
                    <div className="lg:col-span-6 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full">
                      <div className="bg-zinc-900/50 border-b border-zinc-800/80 p-5 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-md">
                          <Info className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-white tracking-tight">System Report</h2>
                          <p className="text-xs text-zinc-400">Status & Metadaten</p>
                        </div>
                      </div>
                      
                      <div className="p-6 grid grid-cols-2 gap-4 flex-1">
                        <div className="bg-zinc-800/20 rounded-lg p-4 border border-zinc-800/50">
                          <div className="text-xs text-zinc-500 mb-1">Status</div>
                          <div className="font-semibold flex items-center gap-2">
                            {selectedBatch.is_anomalous === 1 ? 
                              <span className="text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Anomalie</span> : 
                             selectedBatch.is_anomalous === 0 ?
                              <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Normal</span> :
                              <span className="text-zinc-400 flex items-center gap-1.5"><Info className="w-4 h-4" /> Ungeprüft</span>
                            }
                          </div>
                        </div>
                        <div className="bg-zinc-800/20 rounded-lg p-4 border border-zinc-800/50">
                          <div className="text-xs text-zinc-500 mb-1">Totaler Ertrag</div>
                          <div className="font-semibold text-white">{selectedBatch.yield_kg.toFixed(2)} kg</div>
                        </div>
                        <div className="bg-zinc-800/20 rounded-lg p-4 border border-zinc-800/50">
                          <div className="text-xs text-zinc-500 mb-1">Ausgangskontrolle</div>
                          <div className="font-semibold text-white">{selectedBatch.quality_pass ? 'Bestanden' : 'Durchgefallen'}</div>
                        </div>
                        <div className="bg-zinc-800/20 rounded-lg p-4 border border-zinc-800/50">
                          <div className="text-xs text-zinc-500 mb-1">Grund Ursache</div>
                          <div className="font-semibold text-zinc-300" title={selectedBatch.root_cause_label || 'Keine'}>
                            {rootCauseNames[selectedBatch.root_cause_label] || selectedBatch.root_cause_label || 'Keine relevanten Fehler'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedBatch && (
                    <div className="lg:col-span-6 flex flex-col h-full">
                      <AnimatePresence mode="popLayout">
                        {analyzedPct >= 0 ? (
                          <motion.div 
                            key="assessment"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-zinc-900 border border-zinc-800 border-l-rose-500 border-l-4 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full"
                          >
                            <div className="bg-gradient-to-r from-zinc-900/50 to-zinc-900 border-b border-zinc-800/80 p-5 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-800/80 rounded-md">
                                  <Cpu className="w-5 h-5 text-rose-400" />
                                </div>
                                <div>
                                  <h2 className="text-lg font-semibold text-white tracking-tight">BatchGuard</h2>
                                  <p className="text-xs text-zinc-400">Analyse bei t = {analyzedPct}%</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                              <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed">
                                {aiAssessment ? (
                                  <>
                                    <p dangerouslySetInnerHTML={{ __html: aiAssessment.message }}></p>
                                    {aiAssessment.recommendation && (
                                      <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                        <strong className="text-rose-400 block mb-1 text-[10px] uppercase tracking-wider">Empfehlung:</strong>
                                        {aiAssessment.recommendation}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                    <ActivitySquare className="w-8 h-8 animate-spin mb-4 opacity-20" />
                                    <p className="text-xs">BatchGuard analysiert...</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="no-assessment"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="bg-zinc-900/50 text-zinc-500 border border-zinc-800 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full"
                          >
                            <Cpu className="w-10 h-10 mb-4 opacity-30 text-rose-500/50" />
                            <p className="text-sm">Fordere <strong className="text-rose-400">BatchGuard</strong> an, <br/>um eine punktgenaue KI-Analyse <br/>zu erhalten.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {selectedBatch && (
                    <div className="lg:col-span-12 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col min-h-[500px]">
                      <div className="bg-zinc-900/50 border-b border-zinc-800/80 p-5 flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-md">
                          <ActivitySquare className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-white tracking-tight">Digitaler Zwilling</h2>
                          <p className="text-xs text-zinc-400">Live Reaktor Visualisierung</p>
                        </div>
                      </div>
                      <div className="flex-1 relative">
                        <ReactorTwin 
                          data={plotData.find(pt => pt.t_pct === Math.round(currentPct)) || plotData[plotData.length - 1]} 
                          isAnomalous={liveDrivers.length > 0}
                          variables={liveDrivers}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="charts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12"
              >
                {variables.map((variable, idx) => (
                  <motion.div 
                    key={variable} 
                    className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-5 flex flex-col relative shadow-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-4 relative z-10 w-full bg-zinc-900/80 backdrop-blur-sm rounded pb-1">
                      <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                        <div className="w-2 h-2 rounded bg-blue-500"></div>
                        {varNames[variable]}
                      </h3>
                      {(drivers.find((d: any) => d.variable === variable) || allAnomaliesSoFar.find((d: any) => d.variable === variable)) && (
                        <span className="animate-pulse w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                      )}
                    </div>
                    
                    <div className="h-64 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={plotData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`grad_${variable}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.15}/>
                              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.15}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          {phaseBoundaries.map((b, i) => (
                            <ReferenceArea key={i} x1={b.start} x2={b.end} fill={phaseColorMap[b.phase] || '#18181b'} fillOpacity={0.3} isAnimationActive={false} />
                          ))}
                          <XAxis dataKey="t_pct" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} minTickGap={20} tickFormatter={(val) => `${val}%`} />
                          <YAxis domain={['auto', 'auto']} stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                            itemStyle={{ color: '#e4e4e7', fontSize: '12px' }}
                          />
                          <Area type="monotone" dataKey={(pt) => [pt[`${variable}_lower`], pt[`${variable}_upper`]]} stroke="none" fill={`url(#grad_${variable})`} isAnimationActive={false} />
                          <Line type="linear" dataKey={`${variable}_mean`} stroke="#3b82f6" strokeWidth={2.5} dot={false} isAnimationActive={false}/>
                          <Line type="linear" dataKey={`${variable}_normal`} stroke="#ffffff" strokeWidth={2} connectNulls={false} dot={false} isAnimationActive={false} />
                          <Line type="linear" dataKey={`${variable}_anomaly`} stroke="#f43f5e" strokeWidth={2} connectNulls={false} dot={{ r: 2, fill: '#f43f5e' }} isAnimationActive={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
