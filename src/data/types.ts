export type State = 'Prime' | 'Frail';
export type SpeciesKind = 'playable' | 'wildlife';
export type MetricGroup = 'core' | 'movement' | 'survival' | 'recovery';

export interface DataSource {
  id: string;
  title: string;
  url: string;
  patch: string | null;
  capturedAt: string;
  description: string;
}

export interface Metric {
  key: string;
  label: string;
  unit: string;
  group: MetricGroup;
  sourceColumn: string;
  description?: string;
  uncertain?: boolean;
}

export interface Sample {
  growth: number;
  state: State;
  stage: string;
  sourceId: string;
  peak: boolean;
  evicted: boolean;
  values: Record<string, number | null>;
  /** Exact source text. Blank source cells remain empty strings here. */
  raw: Record<string, string>;
}

export interface Mechanic {
  id: string;
  name: string;
  chart: string;
  mode: 'threshold' | 'multiplier' | 'absolute';
  value: number | null;
  minGrowth: number;
  color: string;
  description: string;
  sourceId: string;
  raw: Record<string, string>;
}

export interface SheetColumn {
  /** Zero-based column index in the original grid. */
  index: number;
  letter: string;
  growth: number;
  /** Displayed percentage; calculations use the exact Stage value above. */
  growthText: string;
  state: State;
  stage: string;
}

export interface SheetValue {
  column: number;
  growth: number;
  state: State;
  stage: string;
  value: number | null;
  text: string;
  cell: string;
}

export interface SheetRow {
  id: string;
  /** One-based original row number. */
  row: number;
  label: string;
  category: 'core' | 'movement' | 'attack' | 'formula' | 'metadata';
  values: SheetValue[];
}

export interface SheetSnapshot {
  title: string;
  sheetId: number;
  url: string;
  sourceId: string;
  patch: string | null;
  range: string;
  rawFile: string;
  /** Formatted source cells. All rows and columns in the bounded snapshot survive. */
  grid: string[][];
  columns: SheetColumn[];
  rows: SheetRow[];
  attacks: SheetRow[];
  formulas: { cell: string; formula: string; value: string }[];
  notes: { cell: string; text: string }[];
  hyperlinks: { cell: string; url: string }[];
}

export interface Species {
  id: string;
  name: string;
  aliases: string[];
  kind: SpeciesKind;
  samples: Sample[];
  mechanics: Mechanic[];
  sheet?: SheetSnapshot;
}

export interface Dataset {
  schemaVersion: number;
  importedAt: string;
  sources: DataSource[];
  metrics: Metric[];
  species: Species[];
  caveats: string[];
  counts: {
    playable: number;
    wildlife: number;
    dashboardRows: number;
    mechanics: number;
    sheetTabs: number;
    sheetFormulas: number;
    sheetNotes: number;
    sheetAttacks: number;
  };
}
