import assert from 'node:assert/strict';
import test from 'node:test';
import {
  brDateToIso,
  calculateDaysRemaining,
  isoDateToBr,
  normalizeBrazilianDate,
  shiftDateString,
} from './date.js';

test('normalizeBrazilianDate aceita DD/MM/AAAA, DD/MM/AA, MM/AAAA e ISO', () => {
  assert.equal(normalizeBrazilianDate('20/11/2026'), '20/11/2026');
  assert.equal(normalizeBrazilianDate('05/03/27'), '05/03/2027');
  assert.equal(normalizeBrazilianDate('12/2026'), '31/12/2026');
  assert.equal(normalizeBrazilianDate('02/2028'), '29/02/2028'); // ano bissexto
  assert.equal(normalizeBrazilianDate('2026-12-15'), '15/12/2026');
  assert.equal(normalizeBrazilianDate('31/02/2026'), null);
  assert.equal(normalizeBrazilianDate('invalido'), null);
});

test('brDateToIso e isoDateToBr convertem sem perda', () => {
  assert.equal(brDateToIso('15/12/2026'), '2026-12-15');
  assert.equal(brDateToIso('11/2026'), '2026-11-30');
  assert.equal(isoDateToBr('2026-12-15'), '15/12/2026');
});

test('calculateDaysRemaining e shiftDateString respeitam diferença de dias', () => {
  const ref = new Date(2026, 10, 25); // 25/11/2026
  assert.equal(calculateDaysRemaining('30/11/2026', ref), 5);
  assert.equal(calculateDaysRemaining('23/11/2026', ref), -2);
  assert.equal(shiftDateString('25/11/2026', 5), '30/11/2026');
  assert.equal(shiftDateString('25/11/2026', -5), '20/11/2026');
});
