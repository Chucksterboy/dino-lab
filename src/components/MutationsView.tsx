import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Dna, Droplets, Drumstick, Globe2, Leaf, LockKeyhole, Search, Shield, Swords, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { mutationCatalog } from '../data/mutations';
import type { Mutation, MutationDiet } from '../data/mutations';

export type MutationFilterCategory = 'all' | 'universal' | 'carnivore' | 'herbivore';
export interface MutationFilters {
  query?: string;
  category?: MutationFilterCategory;
  combatOnly?: boolean;
  status?: 'current' | 'removed';
}

const dietNames: Record<MutationDiet, string> = { carnivore: 'Carnivore', herbivore: 'Herbivore', omnivore: 'Omnivore' };
const categoryInfo: Record<Exclude<MutationFilterCategory, 'all'>, { label: string; color: string; icon: LucideIcon }> = {
  universal: { label: 'Universal', color: '#81e3d0', icon: Globe2 },
  carnivore: { label: 'Carnivore', color: '#f49aa0', icon: Drumstick },
  herbivore: { label: 'Herbivore', color: '#b8ee75', icon: Leaf },
};
const combatInfo: Record<Mutation['combatRole'], { label: string; icon: LucideIcon } | null> = {
  damage: { label: 'Damage', icon: Swords },
  defense: { label: 'Defense', icon: Shield },
  stamina: { label: 'Stamina', icon: Zap },
  bleed: { label: 'Bleed', icon: Droplets },
  none: null,
};
const normalized = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘]/g, "'");

function mutationGroup(mutation: Mutation): Exclude<MutationFilterCategory, 'all'> {
  if (mutation.diets.includes('carnivore')) return 'carnivore';
  if (mutation.diets.includes('herbivore')) return 'herbivore';
  return 'universal';
}

/** Search the mutation names, effects, strengths and eligibility shown in the catalog. */
export function filterMutations(items: readonly Mutation[], filters: MutationFilters = {}): Mutation[] {
  const terms = normalized(filters.query?.trim() ?? '').split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if (item.status !== (filters.status ?? 'current')) return false;
    if (filters.category && filters.category !== 'all' && mutationGroup(item) !== filters.category) return false;
    if (filters.combatOnly && item.combatRole === 'none') return false;
    const searchable = normalized([item.name, ...item.aliases, item.description, ...item.tiers, ...item.restrictions, item.unlock ?? '', ...item.diets.map(diet => dietNames[diet])].join(' '));
    return terms.every(term => searchable.includes(term));
  });
}

export function MutationCard({ mutation }: { mutation: Mutation }) {
  if (mutation.status !== 'current') return null;
  const info = categoryInfo[mutationGroup(mutation)], Icon = info.icon;
  const combat = combatInfo[mutation.combatRole], CombatIcon = combat?.icon;
  return <article className="mutation-card" style={{ '--mutation-accent': info.color } as CSSProperties} aria-labelledby={`mutation-${mutation.id}`}>
    <div className="mutation-card-top"><span className="mutation-family"><Icon size={14} />{info.label}</span><span className="mutation-card-tags">{mutation.unlock && <span className="mutation-unlockable"><LockKeyhole size={12} />Unlockable</span>}{combat && CombatIcon && <span className="mutation-combat"><CombatIcon size={13} />{combat.label}</span>}</span></div>
    <div className="mutation-name-row"><span className="mutation-symbol"><Icon size={22} strokeWidth={1.6} /></span><h3 id={`mutation-${mutation.id}`}>{mutation.name}</h3></div>
    <p className="mutation-effect">{mutation.description}</p>
    {!!mutation.tiers.length && <div className="mutation-progression"><div className="mutation-section-label"><span>Listed strengths</span><span className="mutation-sequence-marks" aria-hidden="true">{mutation.tiers.map((_, index) => <i key={index} />)}</span></div><ol>{mutation.tiers.map((tier, index) => <li key={`${index}-${tier}`}><span className="mutation-step" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{tier}</span></li>)}</ol></div>}
    {mutation.unlock && <div className="mutation-unlock"><LockKeyhole size={15} /><div><span className="mutation-section-label">Unlock condition</span><p>{mutation.unlock}</p></div></div>}
    {!!mutation.restrictions.length && <div className="mutation-restrictions"><span className="mutation-section-label">Eligibility & limits</span><ul>{mutation.restrictions.map((restriction, index) => <li key={`${index}-${restriction}`}>{restriction}</li>)}</ul></div>}
  </article>;
}

export function MutationsView() {
  const [query, setQuery] = useState(''), [category, setCategory] = useState<MutationFilterCategory>('all'), [combatOnly, setCombatOnly] = useState(false);
  const active = mutationCatalog.filter(mutation => mutation.status === 'current');
  const visible = useMemo(() => filterMutations(mutationCatalog, { query, category, combatOnly }), [query, category, combatOnly]);
  const counts: Record<MutationFilterCategory, number> = {
    all: active.length,
    universal: active.filter(item => mutationGroup(item) === 'universal').length,
    carnivore: active.filter(item => mutationGroup(item) === 'carnivore').length,
    herbivore: active.filter(item => mutationGroup(item) === 'herbivore').length,
  };
  const filtered = Boolean(query.trim() || category !== 'all' || combatOnly);
  const reset = () => { setQuery(''); setCategory('all'); setCombatOnly(false); };
  const groups: { id: Exclude<MutationFilterCategory, 'all'>; label: string; icon: LucideIcon; color: string; items: Mutation[] }[] = [
    { id: 'universal', label: 'Universal mutations', icon: Globe2, color: '#81e3d0', items: visible.filter(item => mutationGroup(item) === 'universal') },
    { id: 'carnivore', label: 'Carnivore mutations', icon: Drumstick, color: '#f49aa0', items: visible.filter(item => mutationGroup(item) === 'carnivore') },
    { id: 'herbivore', label: 'Herbivore mutations', icon: Leaf, color: '#b8ee75', items: visible.filter(item => mutationGroup(item) === 'herbivore') },
  ];
  return <div className="mutations-view">
    <header className="mutations-header"><div className="mutations-heading"><div className="mutations-heading-icon" aria-hidden="true"><Dna size={31} strokeWidth={1.5} /><span /></div><div><div className="eyebrow">DINO LAB / TRAIT REFERENCE</div><h1>Mutations<span>.</span></h1><p>Effects, progression and unlock conditions.</p></div></div><div className="mutations-totals"><div><strong>{active.length}</strong><span>ACTIVE MUTATIONS</span></div></div></header>
    <section className="mutations-toolbar" aria-label="Mutation filters">
      <div className="mutations-search-row"><label className="mutations-search"><Search size={18} /><input aria-label="Search mutations" placeholder="Search names, effects or unlock conditions…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Clear mutation search" onClick={() => setQuery('')}><X size={16} /></button>}</label><label className={`mutation-combat-filter${combatOnly ? ' is-active' : ''}`}><input type="checkbox" checked={combatOnly} onChange={event => setCombatOnly(event.target.checked)} /><Swords size={15} /><span>Combat effects</span></label></div>
      <div className="mutations-category-row"><div className="mutation-categories" role="group" aria-label="Mutation category">{([{ id: 'all', label: 'All mutations', icon: Dna }, { id: 'universal', label: 'Universal', icon: Globe2 }, { id: 'carnivore', label: 'Carnivore', icon: Drumstick }, { id: 'herbivore', label: 'Herbivore', icon: Leaf }] as const).map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={category === id} className={category === id ? 'is-selected' : ''} onClick={() => setCategory(id)}><Icon size={15} /><span>{label}</span><small>{counts[id]}</small></button>)}</div></div>
    </section>
    <div className="mutations-result-line" role="status" aria-live="polite"><p><strong>{visible.length}</strong> of {active.length} active mutations{query.trim() && <> matching <span>“{query.trim()}”</span></>}</p>{filtered ? <button className="text-button" onClick={reset}>Reset filters<X size={12} /></button> : <span className="mutations-result-hint"><span />Grouped by mutation type</span>}</div>
    <motion.div className="mutations-results" key={`${category}-${combatOnly}-${query}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .14 }}>
      {groups.filter(group => group.items.length).map(({ id, label, icon: Icon, color, items }) => <section className="mutation-group" key={id} aria-labelledby={`mutation-group-${id}`}><div className="mutation-group-heading" style={{ '--mutation-accent': color } as CSSProperties}><span><Icon size={17} /><h2 id={`mutation-group-${id}`}>{label}</h2><small>{items.length}</small></span><div /></div><div className="mutation-grid">{items.map(mutation => <MutationCard key={mutation.id} mutation={mutation} />)}</div></section>)}
      {!visible.length && <div className="mutations-empty"><span><Search size={28} strokeWidth={1.5} /></span><h2>No active mutations match</h2><p>Try another name, effect or unlock condition, or reset your filters.</p><button className="btn" onClick={reset}>Reset filters<ArrowUpRight size={14} /></button></div>}
    </motion.div>
  </div>;
}
