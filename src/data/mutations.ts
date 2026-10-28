export type MutationCategory = 'universal' | 'carnivore' | 'herbivore' | 'omnivore' | 'unlockable' | 'removed';
export type MutationDiet = 'carnivore' | 'herbivore' | 'omnivore';
export type MutationQuality = 'corroborated' | 'guide-only' | 'conflicting' | 'unclear';
export interface MutationSource { id: string; title: string; url: string; kind: 'community' | 'official' | 'app-source'; capturedAt?: string; qualification?: string }
export interface Mutation {
  id: string;
  name: string;
  aliases: string[];
  category: MutationCategory;
  description: string;
  /** Original listed sequence; an omitted unit remains omitted. */
  tiers: string[];
  restrictions: string[];
  diets: MutationDiet[];
  unlock: string | null;
  combatRole: 'damage' | 'defense' | 'stamina' | 'bleed' | 'none';
  status: 'current' | 'removed';
  quality: MutationQuality;
  sources: string[];
  notes: string[];
  /** Historical metadata only; not included in the card copy. */
  removedIn?: string;
}

const EQG = 'https://www.evrimaquickguide.com/gameplay/health-statuses/mutations';
const EFG = 'https://efg.io.vn/guides/mutations?lang=en';
const EFG_OMNI = 'https://efg.io.vn/playables/omniraptor?lang=en';
const COMMUNITY_REFERENCE = 'https://www.theisle.info/guide/mutations';
const OFFICIAL_DEFAULTS = 'https://store.steampowered.com/news/posts/?appids=376210&enddate=1723038044&feed=steam_community_announcements';
const OFFICIAL_ELDER = 'https://steamcommunity.com/games/TheIsle/announcements/detail/507348444540569207';
const OFFICIAL_REMOVAL = 'https://steamcommunity.com/games/TheIsle/announcements/detail/679628250084806361';
const OFFICIAL_DEVBLOG = 'https://steamcommunity.com/games/TheIsle/announcements/detail/520851629825590491';
export const mutationSources: MutationSource[] = [
  { id: 'eqg', title: 'Evrima Quick Guide · Mutations', url: EQG, kind: 'community', qualification: 'Complete catalogue source; it carries an explicit outdated-information warning.' },
  { id: 'efg', title: 'Evrima Field Guide · Mutation planning', url: EFG, kind: 'community', qualification: 'Cites EQG and official announcements; it is not an independent measurement of every effect.' },
  { id: 'efg-omniraptor', title: 'Evrima Field Guide · Omniraptor mutation notes', url: EFG_OMNI, kind: 'community', qualification: 'Corroborates bleeding and low-health conditions, not current four-strength numeric values.' },
  { id: 'community-reference', title: 'The Isle Info · Mutation reference', url: COMMUNITY_REFERENCE, kind: 'community', qualification: 'Secondary cross-check; older availability statements can conflict with later official changes.' },
  { id: 'official-defaults', title: 'Official mutation configuration example', url: OFFICIAL_DEFAULTS, kind: 'official', qualification: 'Historical server defaults corroborate several initial values; they are not substituted for the guide’s later sequence.' },
  { id: 'official-elder', title: 'Official Elder and mutation changes', url: OFFICIAL_ELDER, kind: 'official', qualification: 'Confirms entombing, sex-related mutations, and changed unlock action counters.' },
  { id: 'official-removal', title: 'Official mutation removal notice', url: OFFICIAL_REMOVAL, kind: 'official', qualification: 'Confirms removal of Traumatic Thrombosis, with future reintegration possible.' },
  { id: 'official-development', title: 'Official mutation development notes', url: OFFICIAL_DEVBLOG, kind: 'official', qualification: 'Development-branch statements require branch and release context.' },
  { id: 'source-1', title: 'Source 1 · Original statistical reference', url: 'https://theisle-speciesdatadashboard.pages.dev/', kind: 'app-source', qualification: 'Baseline stats and limited recovery observations; it does not provide a complete mutation catalogue or stacking rules.' },
  { id: 'source-2', title: 'Source 2 · Original species workbook', url: 'https://docs.google.com/spreadsheets/d/15aOvzrA6Wf5SORil4CQdplKLr6wsSGTE7uGitZlSDGM/edit', kind: 'app-source', qualification: 'Baseline growth, movement and attack values; no mutation catalogue was found in its audited cells.' },
];
export const mutationSourceMetadata = {
  guideLastUpdatedText: '9/4/2026',
  dateFormatAmbiguous: true,
  guideCapturedAt: '2026-10-28T14:23:27Z',
  guideWarningText: 'We are working on updating outdated information :) Stay tuned!',
  rawHtmlPath: 'src/data/raw/mutations/eqg-mutations.html',
  totalEntries: 43,
  activeGuideEntries: 41,
  archivedEntries: 2,
  categoryCounts: { universal: 20, dietSpecific: 12, unlockable: 9, removed: 2 },
  sequenceInterpretation: 'Source order only; no universal Entombment-count or inheritance mapping is asserted.',
};
export const mutationSourceWarning = 'The guide warns that some information is outdated. Listed tiers and restrictions are source claims; unclear units and combat formulas are not inferred.';
type MutationOptions = Partial<Omit<Mutation, 'id' | 'name' | 'category' | 'description' | 'tiers'>>;
function item(name: string, category: MutationCategory, description: string, sequence: string, options: MutationOptions = {}): Mutation {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, aliases: [], category, description,
    tiers: sequence ? sequence.split('|').map(value => value.trim()) : [], restrictions: [],
    diets: category === 'carnivore' ? ['carnivore'] : category === 'herbivore' ? ['herbivore'] : category === 'omnivore' ? ['omnivore'] : [],
    unlock: null, combatRole: 'none', status: category === 'removed' ? 'removed' : 'current', quality: 'guide-only', sources: [EQG], notes: [], ...options,
  };
}

/** Exactly the 43 entries on the requested EQG page, in its original order.
 * Sequence positions are not asserted to be exact Entombment-count mappings.
 * No units or missing fourth strengths are supplied by inference.
 */
export const mutationCatalog: Mutation[] = [
  item('Advanced Gestation', 'universal', 'Shortens egg development, incubation and the wait between nesting cycles.', '50% | 75% | 1 | 1', { restrictions: ['Female only'], quality: 'unclear', notes: ['The final two listed values have no unit. They are not converted into percentages or multipliers.'] }),
  item('Cellular Regeneration', 'universal', 'Improves the rate of health recovery.', '15% | 20% | 25% | 25%'),
  item('Congenital Hypoalgesia', 'universal', 'Reduces damage received when the opposing animal belongs to a larger species.', '15% | 20% | 25% | 25%', { combatRole: 'defense', quality: 'unclear', sources: [EQG, COMMUNITY_REFERENCE, OFFICIAL_DEFAULTS], notes: ['The source says larger species, not heavier selected growth. The exact species-size classification is not documented.', 'Any combat scenario must explicitly qualify the opposing species. Current weight alone does not prove activation.', 'Historical official defaults agree with the initial listed percentage; the full sequence and stacking order remain community-reference values.'] }),
  item('Efficient Digestion', 'universal', 'Slows depletion of the food bar.', '20% | 25% | 30% | 30%'),
  item('Enlarged Meniscus', 'universal', 'Uses stamina to absorb fall damage before health is depleted.', '', { combatRole: 'stamina', quality: 'unclear', notes: ['No strength sequence or stamina-to-damage conversion formula is listed. This is a fall-damage effect, not general attack resistance.'] }),
  item('Epidermal Fibrosis', 'universal', 'Increases resistance to bleeding.', '15% | 20% | 25% | 25%', { combatRole: 'bleed', sources: [EQG, EFG_OMNI], notes: ['A bleed-resistance effect does not establish an equivalent reduction in direct health damage.'] }),
  item('Featherweight', 'universal', 'Makes footprints disappear sooner.', '50%', { notes: ['Only one value is supplied; later strength positions are not listed.'] }),
  item('Gastronomic Regeneration', 'universal', 'Restores some health as food is eaten.', '5% | 10% | 15% | 15%', { restrictions: ['Slots 2 and 4 only'] }),
  item('Hydrodynamic', 'universal', 'The guide describes a bonus to swimming speed.', '15% | 20% | 25% | 25%', { quality: 'conflicting', sources: [EQG, OFFICIAL_DEVBLOG], notes: ['A developer update described removing mutation-based player speed gains, while the guide continues to list a swimming bonus. The statement’s scope and current swimming behavior are unresolved.', 'Do not automatically modify land or flight speed from this entry.'] }),
  item('Hydro-regenerative', 'universal', 'Improves health recovery while rain is falling.', '25% | 50% | 75% | 75%', { aliases: ['Hydroregenerative'] }),
  item('Increased Inspiratory Capacity', 'universal', 'Increases the available oxygen reserve.', '15% | 20% | 25% | 25%'),
  item('Infrasound Communication', 'universal', 'Reduces noise associated with chat communication.', '50% | 60% | 70% | 70%'),
  item('Nocturnal', 'universal', 'Improves health and locked-health recovery during the night.', '5% | 7% | 10% | 10%'),
  item('Osteosclerosis', 'universal', 'Provides resistance to fracture damage.', '20% | 25% | 30% | 30%', { combatRole: 'defense', notes: ['Fracture resistance is not treated as direct health-damage resistance.'] }),
  item('Photosynthetic Tissue', 'universal', 'Improves health and locked-health recovery during daylight.', '5% | 7 % | 10% | 10%'),
  item('Reabsorption', 'universal', 'Replenishes some water in rain or while swimming in drinkable water.', '1 | 2 | 3 | 3', { quality: 'unclear', notes: ['The listed sequence is unitless. No percentage, multiplier or replenishment rate is inferred.'] }),
  item('Sequential Hermaphroditism', 'universal', 'Allows one change to the animal’s sex.', '', { restrictions: ['Not inherited by offspring'], quality: 'corroborated', sources: [EQG, OFFICIAL_ELDER, OFFICIAL_DEVBLOG], notes: ['Official notes corroborate the one-time sex change and non-inheritance. No numeric strength sequence is supplied.'] }),
  item('Submerged Optical Retention', 'universal', 'Extends the range of underwater vision.', '5% | 10% | 20% | 20%'),
  item('Sustained Hydration', 'universal', 'Slows depletion of the water bar.', '20% | 25% | 30% | 30%'),
  item('Wader', 'universal', 'Reduces the movement penalty from shallow water.', '25% | 50% | 75% | 75%'),

  item('Barometric Sensitivity', 'herbivore', 'Provides advance notice of approaching storms or drought.', ''),
  item('Hypervigilance', 'herbivore', 'Broadens eating and drinking camera movement and makes other animals’ footsteps easier to hear.', '50% | 60% | 70% | 70%'),
  item('Photosynthetic Regeneration', 'herbivore', 'Improves stamina recovery during daylight.', '10%', { combatRole: 'stamina', notes: ['Only one value is supplied; later strength positions are not listed.'] }),
  item('Social Behavior', 'herbivore', 'Lets the group leader support a larger group.', '1.5 | 2 | 3 | 3', { aliases: ['Social Behaviour'], diets: ['herbivore', 'omnivore'], restrictions: ['Herbivore or omnivore', 'Group leader only'], quality: 'unclear', notes: ['The sequence does not specify a unit or explicitly identify a multiplier. It is retained without interpreting the numbers as extra members.'] }),
  item('Tactile Endurance', 'herbivore', 'Converts some incoming damage into a stamina cost.', '25% | 35% | 50% | 50%', { restrictions: ['Slots 2 and 4 only'], combatRole: 'stamina', quality: 'unclear', sources: [EQG, COMMUNITY_REFERENCE, OFFICIAL_DEFAULTS], notes: ['The guide does not establish the conversion units, stamina depletion behavior or overflow into health.', 'It is not modeled as free health resistance or a flat health-pool increase. A stamina pool and a confirmed conversion rule would be needed.', 'The older official configuration used a different initial value; its historical value is not substituted for this listed sequence.'] }),
  item('Truculency', 'herbivore', 'Makes bucking more likely to dislodge a latched attacker.', '5% | 10% | 15% | 15%', { combatRole: 'defense' }),
  item('Xerocole Adaptation', 'herbivore', 'Restores some water when plants are eaten.', '15% | 20% | 25% | 25%'),
  item('Accelerated Prey Drive', 'carnivore', 'Adds damage against an animal whose health is below 35%.', '10% | 15% | 20% | 20%', { combatRole: 'damage', quality: 'corroborated', sources: [EQG, COMMUNITY_REFERENCE, EFG_OMNI, OFFICIAL_DEFAULTS], notes: ['The below-35% condition must be checked before each damage event; the bonus is not active throughout an entire fight.', 'Cross-checks support the condition and initial magnitude. The full sequence and combination with other damage bonuses are not independently measured here.'] }),
  item('Cannibalistic', 'carnivore', 'Adds the animal’s own species as nutrient-providing prey when it is not naturally cannibalistic.', '', { restrictions: ['For species that are not naturally cannibalistic', 'Slots 2 and 4 only'], sources: [EQG, OFFICIAL_DEVBLOG], notes: ['The guide supplies no numeric strength sequence. Official development notes describe a temporary removal of its unlock task, so no additional kill or food count is invented.'] }),
  item('Hematophagy', 'carnivore', 'Restores some water while feeding on a corpse.', '15% | 25% | 35% | 35%'),
  item('Hemomania', 'carnivore', 'Adds damage when the recipient is bleeding.', '5% | 7% | 10% | 10%', { combatRole: 'damage', quality: 'corroborated', sources: [EQG, EFG_OMNI, COMMUNITY_REFERENCE, OFFICIAL_DEFAULTS], notes: ['The recipient must actually be bleeding. A bleed-capable attack does not establish that state for every event.', 'The initial percentage and bleeding condition have supporting references; the full sequence and stacking order remain community-reference values.'] }),
  item('Hypermetabolic Inanition', 'carnivore', 'Increases damage as the food bar becomes emptier.', '15% | 20% | 25% | 25%', { restrictions: ['Slots 2 and 4 only'], combatRole: 'damage', quality: 'unclear', sources: [EQG, COMMUNITY_REFERENCE, OFFICIAL_DEFAULTS], notes: ['No continuous hunger-to-damage formula or exact activation curve was found.', 'A bounded scenario or a separately known effective bonus can be shown. A guessed linear hunger multiplier must not be presented as established game math.'] }),

  item('Enhanced Digestion', 'unlockable', 'Slows the loss of nutrients.', '10% | 15% | 25% | 25%', { restrictions: ['Slots 2 and 3'], unlock: 'Keep nutrients for 60 minutes.' }),
  item('Heightened Ghrelin', 'unlockable', 'Increases how much excess food the animal can hold.', '25% | 50% | 75% | 75%', { restrictions: ['Slot 2'], unlock: 'Keep current hunger above 80% for 30 minutes.' }),
  item('Multichambered Lungs', 'unlockable', 'Changes the stamina threshold at which recovery becomes available.', '5% | 10% | 15% | 15%', { restrictions: ['Slots 2 and 3'], unlock: 'Guide condition: spend 4,500 stamina by sprinting or fast swimming.', combatRole: 'stamina', quality: 'conflicting', sources: [EQG, EFG_OMNI, OFFICIAL_ELDER], notes: ['Official released notes instead describe an unlock based on traveling 200,000 units, stated as 2 km. The exact currently active counter is unresolved between the references.', 'The guide describes an increased recovery threshold; EFG describes a lower threshold. No threshold formula or direction is imposed automatically.'] }),
  item('Reinforced Tendons', 'unlockable', 'Reduces jumping stamina costs and Pteranodon takeoff costs.', '25% | 35% | 50% | 50%', { unlock: 'Jump 50 times.', combatRole: 'stamina' }),
  item('Reniculate Kidneys', 'unlockable', 'Enables drinking saltwater after its unlock.', '', { aliases: ['Reniculated Kidneys'], restrictions: ['Slots 2 and 3'], unlock: 'Guide condition: lose 1,250 thirst from saltwater; 50 thirst gives Fluid Deficient and another 1,200 removes it.', quality: 'conflicting', sources: [EQG, COMMUNITY_REFERENCE, OFFICIAL_ELDER], notes: ['The guide also lists a thirst pool of 1,000 and saltwater thirst intake of −2.5%. These are supporting facts, not a strength sequence.', 'Official released notes instead describe drinking 1,000 water units. These use different action counters; their equivalence and current unlock are not established.'] }),
  item('Augmented Tapetum', 'unlockable', 'Improves vision in darkness.', '1 | 2 | 3', { diets: ['carnivore'], restrictions: ['Carnivore only', 'Slot 2'], unlock: 'Kill five players at night.', quality: 'unclear', notes: ['The three listed numbers have no unit. There is no published fourth entry on this page, so none is filled in.'] }),
  item('Osteophagic', 'unlockable', 'Allows bone eating to aid fracture recovery.', '', { diets: ['carnivore'], restrictions: ['Carnivore only'], unlock: 'Eat bones while a bone fracture is present.', quality: 'corroborated', sources: [EQG, OFFICIAL_ELDER], notes: ['Official released notes corroborate eating any amount of bone while any bone fracture is present. No strength sequence is supplied.'] }),
  item('Parthenogenesis', 'unlockable', 'Allows a female to nest and lay eggs without a mate.', '', { aliases: ['P arthenogenesis', 'Parthenogensis'], restrictions: ['Female only', 'Slot 2', 'Not inherited by offspring'], unlock: 'The guide lists availability in slot 2 without another unlock task.', quality: 'corroborated', sources: [EQG, OFFICIAL_ELDER, OFFICIAL_DEVBLOG] }),
  item('Prolific Reproduction', 'unlockable', 'Benefits offspring with faster health and stamina recovery, lower food requirements and faster growth.', '', { restrictions: ['Female only', 'Slot 2'], unlock: 'The guide lists availability in slot 2 without another unlock task.' }),

  item('Intraspecific Aggression', 'removed', 'Historically increased damage against the animal’s own species.', '', { combatRole: 'damage', restrictions: ['Historical reference; unavailable in the active catalogue'], removedIn: '0.15.116', notes: ['The requested guide places this entry in its removed section.'] }),
  item('Traumatic Thrombosis', 'removed', 'Historically prevented a resting animal from dying through blood loss.', '', { combatRole: 'bleed', restrictions: ['Historical reference; unavailable in the active catalogue'], removedIn: '0.21.720', quality: 'corroborated', sources: [EQG, OFFICIAL_REMOVAL], notes: ['An official removal notice corroborates the archive status and leaves open possible future reintegration.', 'An older community reference still lists it as an active slot option; that older listing is not used to reactivate it.'] }),
];
export const byIdMap: Record<string, Mutation> = Object.fromEntries(mutationCatalog.map(mutation => [mutation.id, mutation]));
