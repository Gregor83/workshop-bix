import React, { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceArea } from 'recharts';
import { loadData, BatchMeta, TimeSeriesRow, GoldenProfilePoint } from './data/parser';
import { cn } from './lib/utils';
import { fetchAIAssessment, AIAssessment } from './lib/ai';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, ActivitySquare, AlertCircle, FileText, BarChart3, Database, Play, Pause, RotateCcw, Cpu, Info, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const variables = ['temp_C', 'pressure_bar', 'pH', 'agitator_rpm', 'feed_A_Lph', 'feed_B_Lph'] as const;

// Human-readable variable names
const varNames: Record<string, string> = {
  'temp_C': 'Temperatur',
  'pressure_bar': 'Druck',
  'pH': 'pH-Wert',
  'agitator_rpm': 'Drehzahl',
  'feed_A_Lph': 'Zulauf A',
  'feed_B_Lph': 'Zulauf B'
};

const rootCauseNames: Record<string, string> = {
  'base_pump_calibration': 'Pumpen-Kalibrierung (Lauge)',
  'controller_setpoint_error': 'Sollwert-Fehler (Regler)',
  'none': 'Keine relevanten Fehler',
  'raw_material_viscosity': 'Viskosität d. Rohmaterials',
  'steam_valve_stiction': 'Dampfventil-Blockade',
  'vent_filter_clogging': 'Filter-Verstopfung'
};

// Define a palette for different phases to show in background
const phaseColorMap: Record<string, string> = {
  'Charge': '#18181b',
  'HeatUp': '#27272a',
  'React': '#18181b',
  'Hold': '#27272a',
  'CoolDown': '#18181b',
  'Transfer': '#27272a',
  'CIP': '#18181b'
};

export default function App() {
  const [batches, setBatches] = useState<BatchMeta[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesRow[]>([]);
  const [goldenProfile, setGoldenProfile] = useState<GoldenProfilePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>('A_B003');
  
  // Simulation State
  const [currentPct, setCurrentPct] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // Analysis State
  const [analyzedPct, setAnalyzedPct] = useState<number>(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAssessment, setAiAssessment] = useState<AIAssessment | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'normal' | 'anomaly'>('all');

  useEffect(() => {
    loadData().then(data => {
      setBatches(data.batches);
      setTimeseries(data.timeseries);
      setGoldenProfile(data.goldenProfile);
      setLoading(false);
    });
  }, []);

  // Filter batches list
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchSearch = b.batch_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'all' ? true : filterStatus === 'normal' ? b.is_anomalous === 0 : b.is_anomalous === 1;
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
      }, 100); 
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

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

  const rawPlotData = useMemo(() => {
    if (!selectedBatchId || goldenProfile.length === 0) return [];
    const batchData = timeseries.filter(t => t.batch_id === selectedBatchId);
    
    return goldenProfile.map(gp => {
      const match = batchData.find(b => Math.round(b.t_pct) === gp.t_pct);
      const point: any = { t_pct: gp.t_pct, phase: gp.phase };

      variables.forEach(v => {
        point[`${v}_mean`] = gp[v].mean;
        point[`${v}_lower`] = gp[v].mean - gp[v].std * 2.5; // using 2.5 sigma for visuals too
        point[`${v}_upper`] = gp[v].mean + gp[v].std * 2.5;
        point[`${v}_min`] = gp[v].min;
        point[`${v}_max`] = gp[v].max;
        
        if (match) {
          point[`${v}_raw_batch`] = match[v];
          point[`${v}_zscore`] = Math.abs((match[v] - gp[v].mean) / (gp[v].std || 1));
        }
      });
      return point;
    });
  }, [timeseries, goldenProfile, selectedBatchId]);

  const plotData = useMemo(() => {
    return rawPlotData.map((pt, i, ObjectArray) => {
      const cloned = { ...pt };

      variables.forEach(v => {
        // Only include data up to current currentPct
        const val = cloned.t_pct <= currentPct ? cloned[`${v}_raw_batch`] : null;
        cloned[`${v}_batch`] = val;

        if (val === null || val === undefined) {
           cloned[`${v}_normal`] = null;
           cloned[`${v}_anomaly`] = null;
           return;
        }

        const isAnom = (index: number) => {
            const tempVal = ObjectArray[index].t_pct <= currentPct ? ObjectArray[index][`${v}_raw_batch`] : null;
            if (tempVal === null || tempVal === undefined) return false;
            return tempVal < ObjectArray[index][`${v}_lower`] || tempVal > ObjectArray[index][`${v}_upper`];
        };

        const currentAnom = isAnom(i);
        const prevAnom = i > 0 ? isAnom(i-1) : false;
        const nextAnom = i < ObjectArray.length - 1 ? isAnom(i+1) : false;

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
          if (z > 2.5) anomalyCount++;
          if (z > maxZ) {
            maxZ = z;
            worstPhase = pt.phase;
            worstVal = pt[`${v}_raw_batch`];
            worstExpected = pt[`${v}_mean`];
          }
        }
      });
      
      if (maxZ > 2.5) {
        maxZScores.push({ variable: v, phase: worstPhase, maxZ, count: anomalyCount, worstVal, worstExpected });
      }
    });
    
    return maxZScores.sort((a, b) => b.maxZ - a.maxZ);
  };

  const drivers = useMemo(() => {
    if (analyzedPct < 0) return [];
    return getDriversForPct(analyzedPct);
  }, [rawPlotData, analyzedPct]);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 sticky top-0 backdrop-blur-md z-10 w-full z-50">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="BatchGuard Logo" className="h-16 w-auto" />
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              Golden Batch Detective <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">Agentic AI</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full shadow-lg">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button 
                onClick={() => { setCurrentPct(0); setAnalyzedPct(-1); setIsPlaying(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 mx-2 w-48">
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={currentPct} 
                  onChange={(e) => setCurrentPct(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                />
                <span className="text-xs font-medium w-8 text-right text-zinc-300">{currentPct}%</span>
              </div>
            </div>

            <button 
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || currentPct === 0}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg transition-colors"
            >
              {isAnalyzing ? <ActivitySquare className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              {isAnalyzing ? 'Analysiere...' : 'Agent anfordern'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
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
            <motion.div 
              key={selectedBatchId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                
                {selectedBatch && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full">
                    <div className="bg-zinc-900/50 border-b border-zinc-800/80 p-5 flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-md">
                        <Info className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white tracking-tight">System Report</h2>
                        <p className="text-xs text-zinc-400">Übersicht & Metadaten für {selectedBatch.batch_id}</p>
                      </div>
                    </div>
                    
                    <div className="p-6 grid grid-cols-2 gap-4 flex-1">
                      <div className="bg-zinc-800/20 rounded-lg p-4 border border-zinc-800/50">
                        <div className="text-xs text-zinc-500 mb-1">Status</div>
                        <div className="font-semibold flex items-center gap-2">
                          {selectedBatch.is_anomalous ? 
                            <span className="text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Anomalie</span> : 
                            <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Normal</span>
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
                        <div className="font-semibold text-zinc-300 truncate" title={selectedBatch.root_cause_label || 'Keine'}>
                          {rootCauseNames[selectedBatch.root_cause_label] || selectedBatch.root_cause_label || 'Keine relevanten Fehler'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedBatch && (
                  <div className="flex flex-col h-full h-full">
                    <AnimatePresence mode="popLayout">
                      {analyzedPct >= 0 ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-zinc-900 border border-zinc-800 border-l-blue-500 border-l-4 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full"
                        >
                          <div className="bg-gradient-to-r from-zinc-900/50 to-zinc-900 border-b border-zinc-800/80 p-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-zinc-800/80 rounded-md">
                                <Cpu className="w-5 h-5 text-zinc-300" />
                              </div>
                              <div>
                                <h2 className="text-lg font-semibold text-white tracking-tight">Agenten Einschätzung</h2>
                                <p className="text-xs text-zinc-400">Snapshot bei t = {analyzedPct}%</p>
                              </div>
                            </div>
                            {drivers.length > 0 ? (
                              <div className="flex items-center gap-2 text-rose-400 text-sm font-medium px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
                                <AlertTriangle className="w-4 h-4" /> Warnung
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4" /> OK
                              </div>
                            )}
                          </div>
                          
                          <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed">
                              {aiAssessment ? (
                                <>
                                  <p dangerouslySetInnerHTML={{ __html: aiAssessment.message }}></p>
                                  {aiAssessment.recommendation && (
                                    <div className="mt-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                                      <strong className="text-blue-400 block mb-1">Handlungsempfehlung:</strong>
                                      {aiAssessment.recommendation}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className="text-zinc-500">Lade KI-Einschätzung...</p>
                              )}
                            </div>
                          </div>
                          
                          {aiAssessment?.causes && aiAssessment.causes.length > 0 && (
                            <div className="px-5 py-3 bg-zinc-900/50 border-t border-zinc-800/80 flex flex-wrap gap-2">
                              <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest mr-2 flex items-center">Ursachen:</span>
                              {aiAssessment.causes.slice(0,2).map((c, i) => (
                                <span key={i} className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {varNames[c.variable] || c.variable} ({c.phase})
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="bg-zinc-900/50 text-zinc-500 border border-zinc-800 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full"
                        >
                          <Cpu className="w-10 h-10 mb-4 opacity-30" />
                          <p className="text-sm">Fordere oben den <strong className="text-zinc-400">Agenten</strong> an, <br/>um eine punktgenaue KI-Analyse des aktuellen <br/>Simulations-Stands zu erhalten.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                {variables.map((variable, idx) => (
                  <motion.div 
                    key={variable} 
                    className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-5 flex flex-col relative shadow-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-4 relative z-10 w-full bg-zinc-900/80 backdrop-blur-sm rounded pb-1">
                      <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                        <div className="w-2 h-2 rounded bg-blue-500"></div>
                        {varNames[variable]}
                      </h3>
                      {drivers.find(d => d.variable === variable) && analyzedPct >= 0 && (
                        <span className="animate-pulse w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                      )}
                    </div>
                    
                    <div className="h-48 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={plotData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`grad_${variable}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.15}/>
                              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.15}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          
                          {/* Phases Background */}
                          {phaseBoundaries.map((b, i) => (
                            <ReferenceArea 
                              key={i} 
                              x1={b.start} 
                              x2={b.end} 
                              fill={phaseColorMap[b.phase] || '#18181b'} 
                              fillOpacity={0.8}
                            />
                          ))}
                          
                          {/* Phase Labels on all charts */}
                          {phaseBoundaries.map((b, i) => (
                            ((b.end - b.start) > 10) && <ReferenceArea key={`label-${i}`} x1={b.start} x2={b.end} label={{ position: 'insideTop', value: b.phase, fill: '#52525b', fontSize: 10 }} fillOpacity={0} />
                          ))}

                          <XAxis 
                            dataKey="t_pct" 
                            stroke="#52525b" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            minTickGap={20}
                            tickFormatter={(val) => `${val}%`}
                          />
                          <YAxis 
                            domain={['auto', 'auto']} 
                            stroke="#52525b" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                            itemStyle={{ color: '#e4e4e7', fontSize: '12px' }}
                            labelStyle={{ color: '#a1a1aa', marginBottom: '4px', fontSize: '12px' }}
                            formatter={(value: number, name: string) => {
                              if (name === `${variable}_lower`) return [value.toFixed(2), '-2.5σ Toleranz'];
                              if (name === `${variable}_upper`) return [value.toFixed(2), '+2.5σ Toleranz'];
                              if (name === `${variable}_mean`) return [value.toFixed(2), 'Golden Batch Profil'];
                              if (name === `${variable}_normal` || name === `${variable}_anomaly`) return [<span className="font-bold text-white">{value.toFixed(2)}</span>, 'Dieser Batch'];
                              return [value, name];
                            }}
                            labelFormatter={(label, payload) => {
                              if (payload && payload.length > 0) {
                                return `Phase: ${payload[0].payload.phase} (${label}%)`;
                              }
                              return `${label}%`;
                            }}
                          />
                          
                          <Area 
                            type="monotone" 
                            dataKey={(pt) => [pt[`${variable}_lower`], pt[`${variable}_upper`]]} 
                            stroke="none" 
                            fill={`url(#grad_${variable})`} 
                            isAnimationActive={false} 
                          />
                          <Line type="linear" dataKey={`${variable}_upper`} stroke="#60a5fa" strokeWidth={1} strokeOpacity={0.4} dot={false} strokeDasharray="4 4" isAnimationActive={false}/>
                          <Line type="linear" dataKey={`${variable}_lower`} stroke="#60a5fa" strokeWidth={1} strokeOpacity={0.4} dot={false} strokeDasharray="4 4" isAnimationActive={false}/>
                          <Line type="linear" dataKey={`${variable}_mean`} stroke="#3b82f6" strokeWidth={2.5} strokeOpacity={1} dot={false} isAnimationActive={false}/>
                          
                          {/* Connected White line for normal segments */}
                          <Line 
                            type="linear" 
                            dataKey={`${variable}_normal`} 
                            stroke="#ffffff" 
                            strokeWidth={2} 
                            connectNulls={false}
                            dot={false}
                            activeDot={{ r: 4, fill: '#ffffff', stroke: 'none' }}
                            isAnimationActive={false} 
                          />
                          
                          {/* Connected Red line for anomalous segments */}
                          <Line 
                            type="linear" 
                            dataKey={`${variable}_anomaly`} 
                            stroke="#f43f5e" 
                            strokeWidth={2} 
                            connectNulls={false}
                            dot={false}
                            activeDot={{ r: 6, fill: '#f43f5e', stroke: 'none' }}
                            isAnimationActive={false} 
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
