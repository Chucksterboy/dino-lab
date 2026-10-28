import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attackDamage, hitsToKill, rehydratesInWater, sprintDuration,
  staminaRecovery, standingStaminaRecovery, survivalDuration, swimDuration,
  travelDistance, weightDifferencePercent,
} from '../src/lib/calculations.ts';

test('source hunger checkpoint: Troodon full bar 60 minutes, 1% is 36 seconds', () => {
  assert.equal(survivalDuration(3600, 1), 36);
  assert.equal(survivalDuration(3600, 100), 3600);
  assert.equal(survivalDuration(3600, 0), 0);
  assert.equal(survivalDuration(3600, -10), 0);
  assert.equal(survivalDuration(3600, 120), 3600);
});

test('incomplete/invalid survival data remains unknown', () => {
  for (const value of [undefined, null, NaN, Infinity, 0, -20]) {
    assert.equal(survivalDuration(value, 50), null);
  }
  assert.equal(survivalDuration(3600, undefined), null);
  assert.equal(survivalDuration(3600, NaN), null);
});

test('sprint source growth boundaries: 25–30 plateau, 50 midpoint, 75 adult', () => {
  assert.equal(sprintDuration(60, 25), 600);
  assert.equal(sprintDuration(60, 30), 600);
  assert.equal(sprintDuration(60, 50), 120);
  assert.equal(sprintDuration(60, 75), 60);
  assert.equal(sprintDuration(60, 100), 60);
  assert.equal(sprintDuration(-60, 25), null);
  assert.equal(sprintDuration(null, 25), null);
  assert.equal(sprintDuration(60, NaN), null);
});

test('blood reduces only stamina refill rate; standing excludes bottom 20%', () => {
  assert.equal(staminaRecovery(100, 100), 100);
  assert.equal(staminaRecovery(100, 50), 200);
  assert.equal(staminaRecovery(100, 25), 400);
  assert.equal(staminaRecovery(100, 5), 2000);
  assert.equal(staminaRecovery(100, 0), 2000);
  assert.equal(standingStaminaRecovery(100, 100), 80);
  assert.equal(standingStaminaRecovery(100, 50), 160);
  assert.equal(staminaRecovery(null, 100), null);
  assert.equal(standingStaminaRecovery(100, NaN), null);
});

test('swim preserves adult time and treats negative Deinosuchus source as refill', () => {
  assert.equal(swimDuration(69), 69);
  assert.equal(swimDuration(-303), 303);
  assert.equal(swimDuration(0), null);
  assert.equal(swimDuration(null), null);
});

test('distance uses km/h to m/s, preserves real zero, rejects refill sign', () => {
  assert.equal(travelDistance(36, 60), 600);
  assert.equal(travelDistance(0, 60), 0);
  assert.equal(travelDistance(36, 0), 0);
  assert.equal(travelDistance(36, -60), null);
  assert.equal(travelDistance(null, 60), null);
});

test('damage and hits retain multiplier precision and ceiling body-hit assumption', () => {
  assert.equal(attackDamage(175, 1), 175);
  assert.ok(Math.abs((attackDamage(175, 1.428571) ?? 0) - 249.999925) < 1e-10);
  assert.equal(hitsToKill(1000, 250), 4);
  assert.equal(hitsToKill(1001, 250), 5);
  assert.equal(hitsToKill(1000, attackDamage(175, 1.428571)), 5);
  for (const invalid of [null, undefined, NaN, Infinity, 0, -1]) {
    assert.equal(hitsToKill(1000, invalid), null);
    assert.equal(hitsToKill(invalid, 175), null);
  }
});

test('hit ceiling corrects floating-point integer noise without hiding source remainders', () => {
  assert.equal(153 / 10.2, 15.000000000000002, 'real decimal boundary from Source 1');
  assert.equal(hitsToKill(153, 10.2), 15, 'Allosaurus Frail33% against Gallimimus43%');
  assert.equal(hitsToKill(306, 10.2), 30);
  assert.equal(hitsToKill(10200, 10.2), 1000);
  assert.equal(hitsToKill(1000, attackDamage(175, 1.428571)), 5, 'retain stored multiplier truncation');
  assert.equal(hitsToKill(1.0000000001, 1), 2, 'a real small remainder still needs another event');
  assert.equal(hitsToKill(1e-300, 1e300), 1, 'positive damage always needs at least one event');
  assert.equal(hitsToKill(Number.MAX_VALUE, Number.MIN_VALUE), null, 'an overflow is unknown');
});

test('weight delta remains directional and does not infer absent source values', () => {
  assert.equal(weightDifferencePercent(150, 100), 50);
  assert.equal(weightDifferencePercent(100, 200), -50);
  assert.equal(weightDifferencePercent(100, 100), 0);
  assert.equal(weightDifferencePercent(null, 100), null);
});

test('both Beipiaosaurus source spellings get land-only thirst qualification', () => {
  assert.equal(rehydratesInWater('Deinosuchus'), true);
  assert.equal(rehydratesInWater('Beipiaosaurus'), true);
  assert.equal(rehydratesInWater('Beipiosaurus'), true);
  assert.equal(rehydratesInWater('Troodon'), false);
});
