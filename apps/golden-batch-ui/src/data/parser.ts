import Papa from 'papaparse';

export interface BatchMeta {
  batch_id: string;
  is_anomalous: number;
  anomaly_type: string;
  root_cause_label: string;
  quality_pass: number;
  yield_kg: number;
}

export interface TimeSeriesRow {
  batch_id: string;
  timestamp: string;
  t_pct: number;
  phase: string;
  temp_C: number;
  pressure_bar: number;
  pH: number;
  agitator_rpm: number;
  feed_A_Lph: number;
  feed_B_Lph: number;
}

export interface GoldenProfilePoint {
  t_pct: number;
  phase: string;
  temp_C: { mean: number; std: number; min: number; max: number };
  pressure_bar: { mean: number; std: number; min: number; max: number };
  pH: { mean: number; std: number; min: number; max: number };
  agitator_rpm: { mean: number; std: number; min: number; max: number };
  feed_A_Lph: { mean: number; std: number; min: number; max: number };
  feed_B_Lph: { mean: number; std: number; min: number; max: number };
}

/**
 * Loads and processes batch metadata and time-series data.
 * Calculates a "Golden Profile" (Mean/StdDev) from normal batches for anomaly detection.
 */
export const loadData = async () => {
  // Fetch raw CSV data from the public directory
  const metaRes = await fetch('/data/caseA_batches.csv');
  const metaCsv = await metaRes.text();
  const timeseriesRes = await fetch('/data/caseA_timeseries.csv');
  const timeseriesCsv = await timeseriesRes.text();

  // Parse CSVs into structured objects
  const batches = Papa.parse<BatchMeta>(metaCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
  const timeseries = Papa.parse<TimeSeriesRow>(timeseriesCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

  /**
   * Compute Golden Profile
   * We only use batches labeled as 'normal' (is_anomalous === 0) to define the ideal process behavior.
   */
  const normalBatchIds = new Set(batches.filter(b => b.is_anomalous === 0).map(b => b.batch_id));
  const normalTimeseries = timeseries.filter(row => normalBatchIds.has(row.batch_id));

  // Group data by percentage completion (t_pct) to calculate statistics per step
  const pctGroups = new Map<number, TimeSeriesRow[]>();
  normalTimeseries.forEach(row => {
    const pct = Math.round(row.t_pct || 0);
    if (!pctGroups.has(pct)) {
      pctGroups.set(pct, []);
    }
    pctGroups.get(pct)!.push(row);
  });

  const variables = ['temp_C', 'pressure_bar', 'pH', 'agitator_rpm', 'feed_A_Lph', 'feed_B_Lph'] as const;

  const goldenProfile: GoldenProfilePoint[] = [];

  // Calculate Mean and Standard Deviation for each variable at each process step (0-100%)
  for (let pct = 0; pct <= 100; pct++) {
    const rows = pctGroups.get(pct);
    if (!rows || rows.length === 0) continue;

    const point: Partial<GoldenProfilePoint> = {
      t_pct: pct,
      phase: rows[0].phase, 
    };

    variables.forEach(v => {
      const vals = rows.map(r => r[v] || 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;
      const squaredDiffs = vals.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(variance);
      const min = Math.min(...vals);
      const max = Math.max(...vals);

      point[v] = { mean, std, min, max };
    });

    goldenProfile.push(point as GoldenProfilePoint);
  }

  // Ensure points are ordered by progress
  goldenProfile.sort((a, b) => a.t_pct - b.t_pct);

  return { batches, timeseries, goldenProfile };
};
