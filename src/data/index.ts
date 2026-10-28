import rawDataset from './dataset.json';
import type { Dataset, Metric, Sample, SheetRow, SheetValue, Species, State } from './types';
export type * from './types';

/** Full captured reference, including species intentionally hidden from the app. */
export const sourceDataset = rawDataset as unknown as Dataset;
const removedSpeciesIds = new Set(['babyboar', 'babydeer', 'babygoat']);
export function isRemovedSpeciesId(idOrName: string): boolean {
  return removedSpeciesIds.has(idOrName.trim().toLowerCase());
}
const activeSpecies = sourceDataset.species.filter(item => !isRemovedSpeciesId(item.id));
/** User-visible catalog. Source snapshots and sourceDataset remain untouched. */
export const dataset: Dataset = {
  ...sourceDataset,
  species: activeSpecies,
  counts: {
    ...sourceDataset.counts,
    playable: activeSpecies.filter(item => item.kind === 'playable').length,
    wildlife: activeSpecies.filter(item => item.kind === 'wildlife').length,
    dashboardRows: activeSpecies.reduce((sum, item) => sum + item.samples.length, 0),
    mechanics: activeSpecies.reduce((sum, item) => sum + item.mechanics.length, 0),
  },
};
export const { sources, metrics, species } = dataset;
export const playableSpecies = species.filter(item => item.kind === 'playable');
export const wildlifeSpecies = species.filter(item => item.kind === 'wildlife');
export const metricByKey = Object.fromEntries(metrics.map(metric => [metric.key, metric])) as Record<string, Metric>;

export function getSpecies(idOrName: string): Species | undefined {
  const value = idOrName.toLowerCase();
  return species.find(item => item.id === value || item.name.toLowerCase() === value || item.aliases.some(alias => alias.toLowerCase() === value));
}

function resolveSpecies(value: Species | string): Species | undefined {
  return typeof value === 'string' ? getSpecies(value) : value;
}

/** Matches the dashboard's nearest-growth lookup, with lower growth winning ties. */
export function getSample(value: Species | string, growth: number, state: State = 'Prime'): Sample | undefined {
  if (!Number.isFinite(growth)) return undefined;
  return resolveSpecies(value)?.samples.filter(sample => sample.state === state).reduce<Sample | undefined>((best, sample) => !best || Math.abs(sample.growth - growth) < Math.abs(best.growth - growth) ? sample : best, undefined);
}

export function getSeries(value: Species | string, metricKey: string, state: State = 'Prime') {
  return (resolveSpecies(value)?.samples ?? []).filter(sample => sample.state === state).map(sample => ({ growth: sample.growth, value: sample.values[metricKey] ?? null, sample }));
}

/** Source-flagged peak first, matching the dashboard fallback's normalized composite. */
export function getPeakSample(value: Species | string): Sample | undefined {
  const samples = resolveSpecies(value)?.samples.filter(sample => sample.state === 'Prime') ?? [];
  const marked = samples.find(sample => sample.peak);
  if (marked) return marked;
  const keys = ['weight', 'bite', 'speed'];
  const ranges = keys.map(key => { const values = samples.flatMap(sample => sample.values[key] == null ? [] : [sample.values[key] as number]); return { min: Math.min(...values), max: Math.max(...values) }; });
  let bestScore = -Infinity; let best: Sample | undefined;
  for (const sample of samples) {
    const score = keys.reduce((sum, key, index) => { const value = sample.values[key]; const range = ranges[index]; return sum + (value == null ? 0 : range.max === range.min ? 1 : (value - range.min) / (range.max - range.min)); }, 0);
    if (score > bestScore) { bestScore = score; best = sample; }
  }
  return best;
}

/** Keep positive sub-unit source values visible even when a card requests integers. */
export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const precision = Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.trunc(digits))) : 1;
  const options = Math.abs(value) < 1
    ? { maximumSignificantDigits: Math.max(5, precision) }
    : { maximumFractionDigits: precision };
  return new Intl.NumberFormat('en-US', options).format(value);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const rounded = Math.round(Math.abs(seconds));
  const hours = Math.floor(rounded / 3600); const minutes = Math.floor((rounded % 3600) / 60); const remainder = rounded % 60;
  const duration = hours ? `${hours}h ${minutes}m ${remainder}s` : minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
  return seconds < 0 ? `${duration} · refills` : duration;
}

export function formatMetric(value: number | null | undefined, key: string, includeUnit = true): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const metric = metricByKey[key];
  if (metric?.unit === 's') return formatDuration(value);
  const text = formatNumber(value, key === 'weight' ? 0 : 2);
  return includeUnit && metric?.unit ? `${text} ${metric.unit}` : text;
}

/** Workbook keyframes remain independent from dashboard samples; no interpolation. */
export function getSheetValue(row: SheetRow, growth: number, state: State = 'Prime'): SheetValue | undefined {
  return row.values.filter(value => value.state === state).reduce<SheetValue | undefined>((best, value) => !best || Math.abs(value.growth - growth) < Math.abs(best.growth - growth) ? value : best, undefined);
}
