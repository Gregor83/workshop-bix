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
export const loadData = async (dataset: 'caseA' | 'caseA_test' = 'caseA') => {
  // Always fetch Case A for the Golden Profile calculation (Reference)
  const refMetaRes = await fetch('/data/caseA_batches.csv');
  const refMetaCsv = await refMetaRes.text();
  const refTimeseriesRes = await fetch('/data/caseA_timeseries.csv');
  const refTimeseriesCsv = await refTimeseriesRes.text();

  const refBatches = Papa.parse<BatchMeta>(refMetaCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
  const refTimeseries = Papa.parse<TimeSeriesRow>(refTimeseriesCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

  // Fetch the actual dataset to display
  let batches: BatchMeta[];
  let timeseries: TimeSeriesRow[];

  if (dataset === 'caseA') {
    batches = refBatches;
    timeseries = refTimeseries;
  } else {
    const metaRes = await fetch(`/data/${dataset}_batches.csv`);
    const metaCsv = await metaRes.text();
    const tsRes = await fetch(`/data/${dataset}_timeseries.csv`);
    const tsCsv = await tsRes.text();
    batches = Papa.parse<BatchMeta>(metaCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
    timeseries = Papa.parse<TimeSeriesRow>(tsCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
  }

  /**
   * Compute Golden Profile from Reference (Case A)
   */
  const normalBatchIds = new Set(refBatches.filter(b => b.is_anomalous === 0).map(b => b.batch_id));
  const normalTimeseries = refTimeseries.filter(row => normalBatchIds.has(row.batch_id));

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

  goldenProfile.sort((a, b) => a.t_pct - b.t_pct);

  return { batches, timeseries, goldenProfile };
};
