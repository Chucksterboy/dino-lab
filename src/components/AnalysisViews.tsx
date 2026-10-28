import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowDownUp, ArrowUp, Check, Plus, RotateCcw, Search, Settings2, X } from 'lucide-react';
import { dataset, formatMetric, getSample, getSpecies, isRemovedSpeciesId, metricByKey, metrics, species } from '../data';
import type { Metric, SheetColumn, SheetRow, Species, State } from '../data';
import { accentOf, num, sheetRow, comparisonDifference as percentDifference } from '../lib/ui';
import type { SourceMode } from '../lib/ui';
import { GrowthChart, ScatterChart } from './Chart';

type ViewProps = { onSelect: (specimen: Species) => void; notify: (message: string) => void };
type Selection = { speciesId: string; source: SourceMode; growth: number; state: State; column?: number };
type Slot = Selection & { id: string };
type RowConfig = Record<string, Selection>;
const COMPARISON_KEY = 'dino-lab-comparison-v1';
const TABLE_KEY = 'dino-lab-table-v1';
const COLORS = ['#b8ee75', '#7ed6c6', '#e9ad7f', '#c8b3ef', '#78b8ea', '#e59da6'];
const CORE_KEYS = ['weight', 'bite', 'speed', 'hp'];
const uid = () => globalThis.crypto?.randomUUID?.() ?? `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const sourceName = (source: SourceMode) => source === 'sheet' ? 'Source 2' : 'Source 1';

function columnsFor(specimen: Species, state: State): SheetColumn[] {
  return specimen.sheet?.columns.filter(column => column.state === state) ?? [];
}

function normalizeSelection(input: Selection): Selection {
  const specimen = getSpecies(input.speciesId) ?? species[0];
  const source: SourceMode = input.source === 'sheet' && specimen.sheet ? 'sheet' : specimen.samples.length ? 'dashboard' : 'sheet';
  const state: State = input.state === 'Frail' ? 'Frail' : 'Prime';
  const growth = Number.isFinite(input.growth) ? input.growth : 75;
  if (source === 'sheet') {
    const columns = columnsFor(specimen, state);
    const column = columns.find(item => item.index === input.column) ?? columns.reduce<SheetColumn | undefined>((best, item) => !best || Math.abs(item.growth - growth) < Math.abs(best.growth - growth) ? item : best, undefined);
    return { speciesId: specimen.id, source, state, growth: column?.growth ?? growth, column: column?.index };
  }
  const sample = getSample(specimen, Math.max(25, Math.min(100, growth)), state);
  return { speciesId: specimen.id, source, state, growth: sample?.growth ?? growth };
}

function initialSelection(specimen: Species): Selection {
  return normalizeSelection({ speciesId: specimen.id, source: specimen.samples.length ? 'dashboard' : 'sheet', growth: 75, state: 'Prime' });
}

/** Keep source keyframe indices, so neighboring authored breakpoints stay distinct. */
function patchedSelection(previous: Selection, patch: Partial<Selection>): Selection {
  return normalizeSelection({ ...previous, column: undefined, ...patch });
}

function movementSheetRow(specimen: Species, key: string): SheetRow | undefined {
  if (key === 'sprint') return sheetRow(specimen, 'speed');
  return sheetRow(specimen, key);
}

function valueFor(selection: Selection, key: string): number | null {
  const specimen = getSpecies(selection.speciesId);
  if (!specimen) return null;
  if (selection.source === 'dashboard') return getSample(specimen, selection.growth, selection.state)?.values[key] ?? null;
  const row = movementSheetRow(specimen, key);
  return row?.values.find(value => value.state === selection.state && value.column === selection.column)?.value ?? null;
}

function labelFor(selection: Selection, key: string): string {
  const specimen = getSpecies(selection.speciesId);
  return selection.source === 'sheet' && specimen ? movementSheetRow(specimen, key)?.label ?? metricByKey[key]?.label ?? key : metricByKey[key]?.label ?? key;
}


function SpeciesOptions() {
  return <>{(['playable', 'wildlife'] as const).map(kind => <optgroup key={kind} label={kind === 'playable' ? 'Playable species' : 'Wildlife'}>{species.filter(item => item.kind === kind).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup>)}</>;
}

function GrowthNumber({ growth, onGrowth, label }: { growth: number; onGrowth: (growth: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(growth));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(growth)); }, [growth]);
  return <input type="number" aria-label={label} min="25" max="100" step="1" inputMode="numeric" value={draft} onFocus={() => { focused.current = true; }} onChange={event => setDraft(event.target.value)} onBlur={() => { focused.current = false; const value = draft.trim() === '' ? NaN : Number(draft); if (Number.isFinite(value)) { const next = Math.round(Math.max(25, Math.min(100, value))); setDraft(String(next)); onGrowth(next); } else setDraft(String(growth)); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(growth)); focused.current = false; event.currentTarget.blur(); } }} />;
}

function SelectionControls({ value, onChange, compact = false }: { value: Selection; onChange: (patch: Partial<Selection>) => void; compact?: boolean }) {
  const specimen = getSpecies(value.speciesId)!;
  const columns = columnsFor(specimen, value.state);
  const columnPosition = Math.max(0, columns.findIndex(column => column.index === value.column));
  const fixed = specimen.kind === 'wildlife';
  return <div className={`selection-controls ${compact ? 'compact' : ''}`}>
    <label className="control-field"><span>Data source</span><select aria-label={`${specimen.name} data source`} value={value.source} onChange={event => onChange({ source: event.target.value as SourceMode })}><option value="dashboard" disabled={!specimen.samples.length}>Source 1</option><option value="sheet" disabled={!specimen.sheet}>Source 2</option></select></label>
    <label className="control-field"><span>Condition</span><select aria-label={`${specimen.name} condition`} value={value.state} onChange={event => onChange({ state: event.target.value as State })}><option>Prime</option><option>Frail</option></select></label>
    <div className="growth-control">
      <div className="data-line"><span>{fixed ? 'Fixed wildlife entry' : value.source === 'sheet' ? 'Source keyframe' : 'Growth'}</span><strong>{num(value.growth, 5)}%</strong></div>
      {value.source === 'sheet' ? <>
        {!compact && <input type="range" aria-label={`${specimen.name} Source 2 keyframe`} min="0" max={Math.max(0, columns.length - 1)} step="1" value={columnPosition} onChange={event => { const column = columns[Number(event.target.value)]; if (column) onChange({ column: column.index, growth: column.growth }); }} />}
        <select aria-label={`${specimen.name} exact keyframe`} value={value.column ?? ''} onChange={event => { const column = columns.find(item => item.index === Number(event.target.value)); if (column) onChange({ column: column.index, growth: column.growth }); }}>{columns.map(column => <option key={column.index} value={column.index}>{num(column.growth, 5)}% · {column.letter}{column.stage ? ` · ${column.stage}` : ''}</option>)}</select>
      </> : fixed ? <span className="muted">Wildlife do not grow.</span> : <>
        <input type="range" aria-label={`${specimen.name} growth`} min="25" max="100" step="1" value={value.growth} onChange={event => onChange({ growth: Number(event.target.value) })} />
        {!compact && <label className="growth-number"><GrowthNumber growth={value.growth} label={`${specimen.name} growth percentage`} onGrowth={growth => onChange({ growth })} /><span>%</span></label>}
      </>}
    </div>
  </div>;
}

function parseComparison(text: string): Slot[] {
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== 'object' || !('slots' in input) || !Array.isArray(input.slots) || input.slots.length > 6) throw new Error('Choose a Dino Lab comparison with up to six slots.');
  return input.slots.filter((item:unknown)=>!(item&&typeof item==='object'&&'speciesId' in item&&typeof item.speciesId==='string'&&isRemovedSpeciesId(item.speciesId))).map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('A comparison slot is invalid.');
    const row = item as Record<string, unknown>;
    if (typeof row.speciesId !== 'string' || !getSpecies(row.speciesId) || !['dashboard', 'sheet'].includes(String(row.source)) || !['Prime', 'Frail'].includes(String(row.state)) || typeof row.growth !== 'number' || !Number.isFinite(row.growth)) throw new Error('A slot contains an unknown species, source, condition or growth.');
    return { ...normalizeSelection(row as unknown as Selection), id: uid() };
  });
}

function defaultSlots(): Slot[] {
  return ['allosaurus', 'carnotaurus', 'ceratosaurus'].flatMap(id => { const specimen = getSpecies(id); return specimen ? [{ ...initialSelection(specimen), id: uid() }] : []; });
}

function loadSlots(): Slot[] {
  try { const saved = localStorage.getItem(COMPARISON_KEY); if (saved) return parseComparison(saved); } catch { /* A stale saved configuration should not block startup. */ }
  return defaultSlots();
}

function serializeSlots(slots: Slot[]) {
  return JSON.stringify({ application: 'Dino Lab', version: 1, snapshot: dataset.importedAt, slots: slots.map(({ id: _id, ...selection }) => selection) }, null, 2);
}

export function CompareView({ onSelect, notify }: ViewProps) {
  const [slots, setSlots] = useState<Slot[]>(loadSlots);
  const [addSpecies, setAddSpecies] = useState('tyrannosaurus');
  const [chartMetric, setChartMetric] = useState('weight');
  const [log, setLog] = useState(false);
  const [allMetrics, setAllMetrics] = useState(false);
  const pendingConsumed = useRef(false);
  useEffect(() => {
    if (pendingConsumed.current) return;
    pendingConsumed.current = true;
    let pending: string | null = null;
    try { pending = localStorage.getItem('dinolab-compare-add'); localStorage.removeItem('dinolab-compare-add'); } catch { return; }
    const specimen = pending ? getSpecies(pending) : undefined;
    if (!specimen) return;
    if (slots.length >= 6) { notify('The comparison has six slots. Remove a specimen, then add another.'); return; }
    setSlots(previous => [...previous, { ...initialSelection(specimen), id: uid() }].slice(0, 6));
    notify(`${specimen.name} added to the comparison.`);
  }, [notify, slots.length]);
  useEffect(() => { try { localStorage.setItem(COMPARISON_KEY, serializeSlots(slots)); } catch { /* Storage may be disabled. */ } }, [slots]);
  const changeSlot = (id: string, patch: Partial<Selection>) => setSlots(previous => previous.map(slot => slot.id === id ? { ...patchedSelection(slot, patch), id } : slot));
  const comparedMetrics = metrics.filter(metric => allMetrics || metric.group === 'core' || metric.group === 'movement');
  return <div className="analysis-view compare-view">
    <div className="page-header"><div><div className="eyebrow">THE COMPARISON LAB</div><h1 className="page-heading">Find your edge.</h1><p className="muted">Different species. Different growth. One clear comparison.</p></div><div className="header-actions"><button className="btn" onClick={() => { setSlots(defaultSlots()); notify('Default comparison restored.'); }}><RotateCcw size={15} /> Reset</button></div></div>
    <div className="panel comparison-builder">
      <div className="section-heading"><div><h2>Your specimens <span className="muted">{slots.length}/6</span></h2><p className="muted">Add a species twice to compare life stages.</p></div><button className="btn" onClick={() => setSlots([])} disabled={!slots.length}>Clear all</button></div>
      <div className="comparison-slots" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        {slots.map((slot, index) => { const specimen = getSpecies(slot.speciesId)!; return <div className="comparison-slot" key={slot.id} style={{ borderTop: `2px solid ${COLORS[index]}`, padding: 16 }}>
          <div className="section-heading"><span className="tag" style={{ color: COLORS[index] }}>{index === 0 ? 'REFERENCE' : `SPECIMEN ${index + 1}`}</span><button className="btn-icon" aria-label={`Remove specimen ${index + 1}`} onClick={() => setSlots(previous => previous.filter(item => item.id !== slot.id))}><X size={15} /></button></div>
          <select className="specimen-select" aria-label={`Species in comparison slot ${index + 1}`} value={slot.speciesId} onChange={event => changeSlot(slot.id, { speciesId: event.target.value })}><SpeciesOptions /></select>
          <SelectionControls value={slot} onChange={patch => changeSlot(slot.id, patch)} />
          <div className="slot-foot"><button className="text-button" onClick={() => onSelect(specimen)}>Open species ↗</button></div>
        </div>; })}
      </div>
      <div className="add-specimen-row"><select aria-label="Species to add" value={addSpecies} onChange={event => setAddSpecies(event.target.value)}><SpeciesOptions /></select><button className="btn btn-primary" disabled={slots.length >= 6} onClick={() => { const specimen = getSpecies(addSpecies); if (specimen) setSlots(previous => [...previous, { ...initialSelection(specimen), id: uid() }].slice(0, 6)); }}><Plus size={16} /> Add specimen</button>{slots.length >= 6 && <span className="muted">Six slots are active. Remove one to add another.</span>}</div>
    </div>


    {!!slots.length && <>
      <div className="comparison-results">
        <div className="panel"><div className="section-heading"><div><div className="eyebrow">DINO LAB / COMPARISON</div><h2>Numbers that tell the story.</h2></div><label className="checkbox-control"><input type="checkbox" checked={allMetrics} onChange={event => setAllMetrics(event.target.checked)} /> Include survival & recovery</label></div>
          <div className="table-wrap"><table className="comparison-table"><thead><tr><th>Metric</th>{slots.map((slot, index) => <th key={slot.id}><span style={{ color: COLORS[index] }}>{getSpecies(slot.speciesId)!.name}</span><small>{num(slot.growth, 5)}% · {slot.state}</small>{index === 0 && <small>Reference</small>}</th>)}</tr></thead><tbody>{comparedMetrics.map((metric, metricIndex) => {
            const groupStart = metricIndex === 0 || comparedMetrics[metricIndex - 1].group !== metric.group;
            return <tr className={groupStart ? 'metric-group-start' : ''} key={metric.key}><th><span>{metric.label}{metric.uncertain ? ' *' : ''}</span>{groupStart && <small className="metric-group-label">{metric.group}</small>}</th>{slots.map((slot, index) => { const value = valueFor(slot, metric.key); const difference = percentDifference(value, valueFor(slots[0], metric.key)); return <td key={slot.id} title={`${labelFor(slot, metric.key)} · ${sourceName(slot.source)} · ${value??'Unavailable'} ${metric.unit}`}><strong>{formatMetric(value, metric.key)}</strong>{index > 0 && difference !== null && <small className="comparison-delta">{difference} vs reference</small>}</td>; })}</tr>;
          })}</tbody></table></div><p className="muted table-note">— means this source has no value for the field. Source 2 attack names can differ from Source 1’s bite label. Fields marked * carry source uncertainty.</p>
        </div>
        <div className="section-heading chart-section-heading"><div><h2>Growth, side by side.</h2><p className="muted">Each chart uses its specimen’s own source. Click a chart to select nearby growth.</p></div><div className="header-actions"><select aria-label="Comparison chart metric" value={chartMetric} onChange={event => setChartMetric(event.target.value)}>{metrics.filter(metric => metric.group === 'core' || metric.group === 'movement').map(metric => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select><label className="checkbox-control"><input type="checkbox" checked={log} onChange={event => setLog(event.target.checked)} /> Log scale</label></div></div>
        <div className="comparison-chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 16 }}>{slots.map((slot, index) => { const specimen = getSpecies(slot.speciesId)!; return <div className="panel" key={slot.id}><div className="section-heading"><h3 style={{ color: COLORS[index] }}>{specimen.name}</h3><span className="tag">{num(slot.growth, 5)}% · {slot.state}</span></div><p className="muted">{sourceName(slot.source)} · {metricByKey[chartMetric]?.label}</p><GrowthChart specimen={specimen} metric={chartMetric} growth={slot.growth} state={slot.state} source={slot.source} log={log} compact onGrowth={growth => changeSlot(slot.id, { growth })} /></div>; })}</div>
        <p className="muted snapshot-note">Offline snapshot · {dataset.importedAt.slice(0, 10)} · Dino Lab</p>
      </div>
    </>}
  </div>;
}

function defaultRows(): RowConfig {
  return Object.fromEntries(species.map(specimen => [specimen.id, initialSelection(specimen)]));
}

function loadRows(): RowConfig {
  const defaults = defaultRows();
  try { const saved = JSON.parse(localStorage.getItem(TABLE_KEY) ?? '{}') as RowConfig; for (const [id, value] of Object.entries(saved)) if (getSpecies(id) && value && typeof value === 'object') defaults[id] = normalizeSelection({ ...value, speciesId: id }); } catch { /* Default rows survive malformed stored state. */ }
  return defaults;
}

const TABLE_GROUPS: { id: string; label: string; keys: string[] }[] = [
  { id: 'core', label: 'Core statistics', keys: ['weight', 'bite', 'speed', 'hp', 'trot', 'fastSwim'] },
  { id: 'movement', label: 'All movement speeds', keys: metrics.filter(metric => metric.group === 'movement').map(metric => metric.key) },
  { id: 'survival', label: 'Stamina & survival', keys: ['staminaDrain', 'fastSwimDuration', 'slowSwimDuration', 'hunger', 'thirst', 'oxygen', 'maxStamina'] },
  { id: 'recovery', label: 'Recovery & source fields', keys: metrics.filter(metric => metric.group === 'recovery').map(metric => metric.key) },
];

export function TableView({ onSelect, notify }: ViewProps) {
  const [rows, setRows] = useState<RowConfig>(loadRows);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'playable' | 'wildlife'>('playable');
  const [group, setGroup] = useState('core');
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 }>({ key: 'weight', direction: -1 });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSource, setBulkSource] = useState<'keep' | SourceMode>('keep');
  const [bulkGrowth, setBulkGrowth] = useState(75);
  const [bulkState, setBulkState] = useState<State>('Prime');
  const [showScatter, setShowScatter] = useState(false);
  const [scatterSource, setScatterSource] = useState<SourceMode>('dashboard');
  const [scatterPeak, setScatterPeak] = useState(true);
  const [scatterState, setScatterState] = useState<State>('Prime');
  const [scatterGrowth, setScatterGrowth] = useState(75);
  const [scatterLog, setScatterLog] = useState(true);
  useEffect(() => { try { localStorage.setItem(TABLE_KEY, JSON.stringify(rows)); } catch { /* Storage can be disabled. */ } }, [rows]);
  const visibleMetrics: Metric[] = (TABLE_GROUPS.find(item => item.id === group)?.keys ?? CORE_KEYS).map(key => metricByKey[key]).filter(Boolean);
  const filtered = useMemo(() => species.filter(specimen => (kind === 'all' || specimen.kind === kind) && [specimen.name, ...specimen.aliases].some(name => name.toLowerCase().includes(query.trim().toLowerCase()))), [kind, query]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort.key === 'name') return a.name.localeCompare(b.name) * sort.direction;
    const av = valueFor(rows[a.id], sort.key); const bv = valueFor(rows[b.id], sort.key);
    if (av === null) return bv === null ? a.name.localeCompare(b.name) : 1;
    if (bv === null) return -1;
    return (av - bv) * sort.direction || a.name.localeCompare(b.name);
  }), [filtered, rows, sort]);
  const changeRow = (id: string, patch: Partial<Selection>) => setRows(previous => ({ ...previous, [id]: patchedSelection(previous[id], patch) }));
  const sortBy = (key: string) => setSort(previous => ({ key, direction: previous.key === key ? previous.direction === 1 ? -1 : 1 : key === 'name' ? 1 : -1 }));
  const sortIcon = (key: string) => sort.key === key ? sort.direction === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowDownUp size={12} />;
  return <div className="analysis-view species-table-view">
    <div className="page-header"><div><div className="eyebrow">THE COMPLETE PICTURE</div><h1 className="page-heading">Every species. Every detail.</h1><p className="muted">Explore {dataset.counts.playable} playable species and {dataset.counts.wildlife} wildlife entries. Set growth and condition for each row.</p></div><div className="header-actions"><button className="btn" onClick={() => { setRows(defaultRows()); notify('Species table reset to 75% Prime.'); }}><RotateCcw size={15} /> Reset rows</button></div></div>
    <div className="panel table-controls"><div className="table-filter-row"><div className="search-field"><Search size={16} /><input aria-label="Search all species" placeholder="Find a species…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="btn-icon" aria-label="Clear species search" onClick={() => setQuery('')}><X size={14} /></button>}</div><div className="segmented" role="group" aria-label="Species kind">{(['playable', 'wildlife', 'all'] as const).map(value => <button key={value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>{value === 'all' ? 'All species' : value === 'playable' ? 'Playable' : 'Wildlife'}</button>)}</div><select aria-label="Statistics group" value={group} onChange={event => { setGroup(event.target.value); const next = TABLE_GROUPS.find(item => item.id === event.target.value); if (next && !next.keys.includes(sort.key)) setSort({ key: next.keys[0], direction: -1 }); }}>{TABLE_GROUPS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button className={`btn ${bulkOpen ? 'active' : ''}`} onClick={() => setBulkOpen(open => !open)}><Settings2 size={15} /> Set visible rows</button></div>
      {bulkOpen && <div className="bulk-controls"><label className="control-field"><span>Data source</span><select value={bulkSource} onChange={event => setBulkSource(event.target.value as 'keep' | SourceMode)}><option value="keep">Keep each source</option><option value="dashboard">Source 1 where available</option><option value="sheet">Source 2 where available</option></select></label><label className="control-field"><span>Growth</span><input aria-label="Bulk growth percentage" type="number" min="0" max="100" value={bulkGrowth} onChange={event => setBulkGrowth(Math.max(0, Math.min(100, Number(event.target.value))))} /></label><label className="control-field"><span>Condition</span><select value={bulkState} onChange={event => setBulkState(event.target.value as State)}><option>Prime</option><option>Frail</option></select></label><button className="btn btn-primary" disabled={!filtered.length} onClick={() => { setRows(previous => { const next = { ...previous }; for (const specimen of filtered) next[specimen.id] = patchedSelection(previous[specimen.id], { growth: bulkGrowth, state: bulkState, source: bulkSource === 'keep' ? previous[specimen.id].source : bulkSource }); return next; }); notify(`Updated ${filtered.length} visible rows to their nearest available source growth.`); }}><Check size={15} /> Apply to {filtered.length} rows</button><p className="muted">Source 2 uses exact keyframes; Source 1 growth starts at 25%. Wildlife remain fixed.</p></div>}
    </div>
    <div className="panel species-table-capture"><div className="section-heading"><div><div className="eyebrow">DINO LAB / SPECIES INDEX</div><h2>{kind === 'wildlife' ? 'Wildlife' : kind === 'playable' ? 'Playable species' : 'All species'} <span className="muted">{sorted.length}</span></h2></div><span className="muted">{TABLE_GROUPS.find(item => item.id === group)?.label} · click a heading to sort</span></div><div className="table-wrap"><table className="species-data-table"><thead><tr><th><button onClick={() => sortBy('name')}>Species {sortIcon('name')}</button></th><th>Source / condition</th><th>Growth</th>{visibleMetrics.map(metric => <th key={metric.key}><button onClick={() => sortBy(metric.key)}>{metric.label}{metric.uncertain ? ' *' : ''} {sortIcon(metric.key)}</button><small>{metric.unit}</small></th>)}</tr></thead><tbody>{sorted.map(specimen => { const selection = rows[specimen.id]; const columns = columnsFor(specimen, selection.state); return <tr key={specimen.id}><th><button className="species-table-name" onClick={() => onSelect(specimen)}><span className="species-dot" style={{ background: accentOf(specimen) }} />{specimen.name}<span className="muted">↗</span></button><small>{specimen.kind === 'wildlife' ? 'Wildlife' : !specimen.samples.length ? 'Source 2 only' : 'Playable'}</small></th><td><div className="table-source-controls"><select aria-label={`${specimen.name} table source`} value={selection.source} onChange={event => changeRow(specimen.id, { source: event.target.value as SourceMode })}><option value="dashboard" disabled={!specimen.samples.length}>Source 1</option><option value="sheet" disabled={!specimen.sheet}>Source 2</option></select><select aria-label={`${specimen.name} table condition`} value={selection.state} onChange={event => changeRow(specimen.id, { state: event.target.value as State })}><option>Prime</option><option>Frail</option></select></div></td><td><div className="table-growth-control"><strong>{num(selection.growth, 5)}%</strong>{selection.source === 'sheet' ? <><input type="range" aria-label={`${specimen.name} table Source 2 slider`} min="0" max={Math.max(0, columns.length - 1)} step="1" value={Math.max(0, columns.findIndex(column => column.index === selection.column))} onChange={event => { const column = columns[Number(event.target.value)]; if (column) changeRow(specimen.id, { column: column.index, growth: column.growth }); }} /><select aria-label={`${specimen.name} table keyframe`} value={selection.column} onChange={event => { const column = columns.find(item => item.index === Number(event.target.value)); if (column) changeRow(specimen.id, { column: column.index, growth: column.growth }); }}>{columns.map(column => <option value={column.index} key={column.index}>{num(column.growth, 5)}% · {column.letter}</option>)}</select></> : specimen.kind === 'wildlife' ? <small>Fixed</small> : <><input type="range" aria-label={`${specimen.name} table growth`} min="25" max="100" step="1" value={selection.growth} onChange={event => changeRow(specimen.id, { growth: Number(event.target.value) })} /><GrowthNumber growth={selection.growth} label={`${specimen.name} table growth percentage`} onGrowth={growth => changeRow(specimen.id, { growth })} /></>}</div></td>{visibleMetrics.map(metric => <td key={metric.key} title={`${labelFor(selection, metric.key)} · ${sourceName(selection.source)} · ${valueFor(selection, metric.key)??'Unavailable'} ${metric.unit}`}><strong>{formatMetric(valueFor(selection, metric.key), metric.key)}</strong></td>)}</tr>; })}</tbody></table></div>{!sorted.length && <div className="empty-text">No species match “{query}”. Clear the search or choose a different species group.</div>}<p className="muted table-note">Source 1 and Source 2 records remain separate. — means unknown in the chosen source. * Source uncertainty applies.</p></div>
    <div className="panel scatter-panel"><div className="section-heading"><div><h2>Speed meets size.</h2><p className="muted">Explore the species in your current filter. Select a point to open its profile.</p></div><button className="btn" onClick={() => setShowScatter(open => !open)}>{showScatter ? 'Hide scatter plot' : 'Explore scatter plot'}</button></div>{showScatter && <><div className="scatter-controls header-actions"><label className="control-field"><span>Source</span><select aria-label="Scatter data source" value={scatterSource} onChange={event => setScatterSource(event.target.value as SourceMode)}><option value="dashboard">Source 1</option><option value="sheet">Source 2</option></select></label><label className="control-field"><span>Condition</span><select aria-label="Scatter condition" value={scatterState} onChange={event => setScatterState(event.target.value as State)}><option>Prime</option><option>Frail</option></select></label><label className="checkbox-control"><input type="checkbox" checked={scatterPeak} onChange={event => setScatterPeak(event.target.checked)} /> Peak per species</label><label className="checkbox-control"><input type="checkbox" checked={scatterLog} onChange={event => setScatterLog(event.target.checked)} /> Log weight scale</label>{!scatterPeak && <label className="control-field"><span>Growth {scatterGrowth}%</span><input aria-label="Scatter growth" type="range" min={scatterSource === 'sheet' ? 0 : 25} max="100" value={scatterGrowth} onChange={event => setScatterGrowth(Number(event.target.value))} /></label>}</div><ScatterChart items={filtered} state={scatterState} growth={scatterGrowth} source={scatterSource} atPeak={scatterPeak} log={scatterLog} onSelect={onSelect} /><p className="muted">{scatterPeak ? 'Peak uses the source flag where available, then a combined normalized weight, primary attack and speed score within each species.' : 'Each species uses its nearest available growth in this source.'} Species without both weight and speed are omitted.</p></>}</div>
  </div>;
}
