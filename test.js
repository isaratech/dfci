// Vérification de l'algorithme DFCI — `node test.js`
// Vecteur de référence : https://github.com/ptro46/GPS-DFCI (44.671123, 1.277227 → FE06H1.2)
const assert = require('assert');
global.proj4 = require('./vendor/proj4.js');
const DFCI = require('./dfci.js');

assert.strictEqual(DFCI.fromLatLng(44.671123, 1.277227), 'FE06H1.2');
assert.strictEqual(DFCI.fromLatLng(43.2965, 5.3698).slice(0, 2), 'KD'); // Marseille
assert.strictEqual(DFCI.fromLatLng(51.5074, -0.1278), null); // Londres : hors zone
assert.strictEqual(DFCI.cellLabel(...DFCI.toLambert(44.671123, 1.277227), 100000), 'FE');
assert.strictEqual(DFCI.cellLabel(...DFCI.toLambert(44.671123, 1.277227), 20000), 'FE06');
assert.strictEqual(DFCI.cellLabel(...DFCI.toLambert(44.671123, 1.277227), 2000), 'FE06H1');

console.log('OK');
