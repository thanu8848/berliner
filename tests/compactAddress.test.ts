import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compactAddress } from '../src/services/compactAddress'

test('compact provider labels keep street, house number and postcode', () => {
 assert.equal(compactAddress('29, Marienburger Straße, Winsviertel, Prenzlauer Berg, Pankow, Berlin, 10405, Deutschland'), 'Marienburger Straße 29 · 10405')
 assert.equal(compactAddress('al andalus, 29, Marienburger Straße, Prenzlauer Berg, Berlin, 10405, Deutschland'), 'Marienburger Straße 29 · 10405')
 assert.equal(compactAddress('Turmstraße 85, 10551 Berlin'), 'Turmstraße 85 · 10551')
 assert.equal(compactAddress('Turmstraße, 85a, Moabit, 10551, Deutschland'), 'Turmstraße 85a · 10551')
 assert.equal(compactAddress('Am Kupfergraben 2, 10117 Berlin'), 'Am Kupfergraben 2 · 10117')
})
test('presentation preserves unknown formats and distinguishes house numbers', () => {
 assert.equal(compactAddress('Café Unbekannt, Berlin'), 'Café Unbekannt, Berlin')
 assert.equal(compactAddress('Marienburger Straße, Berlin'), 'Marienburger Straße, Berlin')
 assert.notEqual(compactAddress('Turmstraße 85, 10551 Berlin'), compactAddress('Turmstraße 86, 10551 Berlin'))
 assert.equal(compactAddress('Turmstraße 85-86, 10551 Berlin'), 'Turmstraße 85-86 · 10551')
})
