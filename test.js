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

// Décodage code → Lambert : aller-retour sur le vecteur de référence
const cell = DFCI.dfciToLambert('FE06H1.2');
assert.strictEqual(cell.code, 'FE06H1.2');
assert.strictEqual(cell.size, 1000);
assert.strictEqual(DFCI.dfciFromLambert(cell.x + 250, cell.y + 250), 'FE06H1.2');
const [x0, y0] = DFCI.toLambert(44.671123, 1.277227);
assert.ok(x0 >= cell.x && x0 < cell.x + cell.size && y0 >= cell.y && y0 < cell.y + cell.size);

// Codes partiels, minuscules et sans point acceptés
assert.strictEqual(DFCI.dfciToLambert('kd').size, 100000);
assert.strictEqual(DFCI.dfciToLambert('KD42').size, 20000);
assert.strictEqual(DFCI.dfciToLambert('KD42F7').size, 2000);
assert.strictEqual(DFCI.dfciToLambert('kd42f75').code, 'KD42F7.5');
assert.strictEqual(DFCI.dfciToLambert(' KD 42 F7 .5 ').code, 'KD42F7.5');

// Quadrants : 5 = carré central de 1 km, 1 = NO, 3 = SE
const c2 = DFCI.dfciToLambert('KD42F7');
const c5 = DFCI.dfciToLambert('KD42F7.5');
assert.deepStrictEqual([c5.x - c2.x, c5.y - c2.y], [500, 500]);
const c1 = DFCI.dfciToLambert('KD42F7.1');
assert.deepStrictEqual([c1.x - c2.x, c1.y - c2.y], [0, 1000]);
const c3 = DFCI.dfciToLambert('KD42F7.3');
assert.deepStrictEqual([c3.x - c2.x, c3.y - c2.y], [1000, 0]);

// Codes invalides
assert.strictEqual(DFCI.dfciToLambert('IJ00'), null); // lettres I et J exclues
assert.strictEqual(DFCI.dfciToLambert('KA42'), null); // 2e lettre A hors grille
assert.strictEqual(DFCI.dfciToLambert('KD43'), null); // chiffres 20 km impairs
assert.strictEqual(DFCI.dfciToLambert('KD42M7'), null); // lettre 2 km hors alphabet
assert.strictEqual(DFCI.dfciToLambert('KD42F7.6'), null); // quadrant hors 1-5
assert.strictEqual(DFCI.dfciToLambert(''), null);
assert.strictEqual(DFCI.dfciToLambert('n’importe quoi'), null);

console.log('OK');
