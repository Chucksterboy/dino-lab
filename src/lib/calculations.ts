/**
 * Source-faithful arithmetic for the SpeciesData dashboard.
 * Reference: https://theisle-speciesdatadashboard.pages.dev/
 * Audited against its survivalDuration/survLeft, updateFactChips, bloodFactor,
 * gaitRange and killCell behavior on 2026-10-28. Full qualifications live in
 * docs/DATA-VALIDATION.md. These functions do not establish new game mechanics.
 *
 * Important: fast/slow swim is NOT growth-scaled. Blood scales stamina refill
 * only, not stamina drain, blood recovery, health recovery or oxygen. Health
 * recovery/mud-walking data remains unverified. Hunger estimates stop at empty
 * and exclude additional server-dependent food consumed while growing.
 */

type OptionalNumber = number | null | undefined;

function finite(value: OptionalNumber): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positive(value: OptionalNumber): value is number {
  return finite(value) && value > 0;
}

export function clampPercent(value: number, minimum = 0): number {
  return Math.max(minimum, Math.min(100, value));
}

/** Seconds until hunger/water reaches zero; missing source duration is unknown. */
export function survivalDuration(fullSeconds: OptionalNumber, levelPercent: OptionalNumber): number | null {
  if (!positive(fullSeconds) || !finite(levelPercent)) return null;
  return fullSeconds * clampPercent(levelPercent) / 100;
}

/** Positive sprint drain only. The measured rule applies to 25–100% growth. */
export function sprintDuration(adultSeconds: OptionalNumber, growthPercent: OptionalNumber): number | null {
  if (!positive(adultSeconds) || !finite(growthPercent)) return null;
  const growthFactor = Math.min(1, Math.max(0.1, (growthPercent - 25) / 50));
  return adultSeconds / growthFactor;
}

/** Source full-bar stamina refill divided by current blood fraction (5–100%). */
export function staminaRecovery(fullSeconds: OptionalNumber, bloodPercent: OptionalNumber): number | null {
  if (!positive(fullSeconds) || !finite(bloodPercent)) return null;
  return fullSeconds / (clampPercent(bloodPercent, 5) / 100);
}

/** Standing refill starts at 20% by default; that floor is observational. */
export function standingStaminaRecovery(
  fullSeconds: OptionalNumber,
  bloodPercent: OptionalNumber,
  floorPercent = 20,
): number | null {
  const full = staminaRecovery(fullSeconds, bloodPercent);
  if (full === null || !Number.isFinite(floorPercent)) return null;
  return full * (1 - clampPercent(floorPercent) / 100);
}

/** Meters at a fixed gait; negative source refill durations are not travel costs. */
export function travelDistance(speedKmh: OptionalNumber, seconds: OptionalNumber): number | null {
  if (!finite(speedKmh) || speedKmh < 0 || !finite(seconds) || seconds < 0) return null;
  return speedKmh / 3.6 * seconds;
}

/** Multiplier attacks only. Wildlife absolute attacks must use their flat value. */
export function attackDamage(biteForce: OptionalNumber, multiplier: OptionalNumber): number | null {
  if (!positive(biteForce) || !positive(multiplier)) return null;
  return biteForce * multiplier;
}

/** Body-hit estimate. Caller chooses playable weight or explicit wildlife HP. */
export function hitsToKill(hp: OptionalNumber, damage: OptionalNumber): number | null {
  if (!positive(hp) || !positive(damage)) return null;
  const quotient = hp / damage;
  if (!Number.isFinite(quotient)) return null;
  if (quotient < 1) return 1; // Includes positive ratios that underflow to zero.
  // Decimal source values such as 153 / 10.2 can land a few floating-point
  // steps above an integer. Correct only that representational noise. A true
  // source-multiplier remainder (1000 / 249.999925) must still round upward.
  const nearest = Math.round(quotient);
  const tolerance = 4 * Number.EPSILON * Math.max(1, quotient);
  if (nearest >= 1 && Math.abs(quotient - nearest) <= tolerance) return nearest;
  return Math.ceil(quotient);
}

export function weightDifferencePercent(weight: OptionalNumber, otherStateWeight: OptionalNumber): number | null {
  if (!positive(weight) || !positive(otherStateWeight)) return null;
  return (weight / otherStateWeight - 1) * 100;
}

/** Return a duration magnitude without inventing growth scaling for swim. */
export function swimDuration(sourceSeconds: OptionalNumber): number | null {
  return finite(sourceSeconds) && sourceSeconds !== 0 ? Math.abs(sourceSeconds) : null;
}

/** Exact source alias handling for the land-only thirst note. */
export function rehydratesInWater(speciesName: string): boolean {
  return ['deinosuchus', 'beipiosaurus', 'beipiaosaurus'].includes(speciesName.trim().toLowerCase());
}
