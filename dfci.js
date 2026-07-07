// DFCI grid — kilometric grid in extended Lambert II (EPSG:27572).
// Breakdown: 100 km squares (2 letters, without I or J), 20 km (2 even digits),
// 2 km (letter + digit), then the 2 km square split into 5 zones
// (1=NW, 2=NE, 3=SE, 4=SW, 5=center).
/* global proj4 */

const LAMBERT_2E =
  '+proj=lcc +lat_1=46.8 +lat_0=46.8 +lon_0=0 +k_0=0.99987742 ' +
  '+x_0=600000 +y_0=2200000 +a=6378249.2 +b=6356515 ' +
  '+towgs84=-168,-60,320 +pm=paris +units=m +no_defs'; // ponytail: towgs84 with 6 zeros → NaN with proj4js, the 3-parameter form is enough (NTF)

const LETTERS_100 = 'ABCDEFGHKLMN';
const LETTERS_2 = 'ABCDEFGHKL';

// Validity area of the grid (metropolitan France)
const BOUNDS = { minX: 0, maxX: 1200000, minY: 1600000, maxY: 2700000 };

function toLambert(lat, lng) {
  return proj4(LAMBERT_2E, [lng, lat]); // [x, y] in meters
}

function toLatLng(x, y) {
  const [lng, lat] = proj4(LAMBERT_2E, proj4.WGS84, [x, y]);
  return [lat, lng];
}

function dfciFromLambert(x, y) {
  if (x <= BOUNDS.minX || x >= BOUNDS.maxX || y <= BOUNDS.minY || y >= BOUNDS.maxY) return null;
  y -= BOUNDS.minY;
  let code = LETTERS_100[Math.floor(x / 100000)] + LETTERS_100[Math.floor(y / 100000) + 1];
  let dx = x % 100000;
  let dy = y % 100000;
  code += Math.floor(dx / 20000) * 2 + '' + Math.floor(dy / 20000) * 2;
  dx %= 20000;
  dy %= 20000;
  code += LETTERS_2[Math.floor(dx / 2000)] + '' + Math.floor(dy / 2000);
  dx %= 2000;
  dy %= 2000;
  let q;
  if (dx > 500 && dx < 1500 && dy > 500 && dy < 1500) q = 5;
  else if (dx < 1000) q = dy >= 1000 ? 1 : 4;
  else q = dy >= 1000 ? 2 : 3;
  return code + '.' + q;
}

function fromLatLng(lat, lng) {
  const [x, y] = toLambert(lat, lng);
  return dfciFromLambert(x, y);
}

// Decoding of a DFCI code, full or partial (AA, AA00, AA00A0, AA00A0.5).
// Returns { code, x, y, size }: normalized code, Lambert south-west corner and side
// of the cell in meters (quadrant 1-5 corresponds to a 1 km cell), or null.
function dfciToLambert(input) {
  const s = String(input).toUpperCase().replace(/[\s.]/g, '');
  const m = /^([A-Z])([A-Z])(?:(\d)(\d)(?:([A-Z])(\d)([1-5])?)?)?$/.exec(s);
  if (!m) return null;
  const ix = LETTERS_100.indexOf(m[1]);
  const iy = LETTERS_100.indexOf(m[2]) - 1;
  if (ix < 0 || iy < 0) return null;
  let x = ix * 100000;
  let y = BOUNDS.minY + iy * 100000;
  let size = 100000;
  let code = m[1] + m[2];
  if (m[3]) {
    if (m[3] % 2 || m[4] % 2) return null; // 20 km step: even digits only
    x += (m[3] / 2) * 20000;
    y += (m[4] / 2) * 20000;
    size = 20000;
    code += m[3] + m[4];
  }
  if (m[5]) {
    const kx = LETTERS_2.indexOf(m[5]);
    if (kx < 0) return null;
    x += kx * 2000;
    y += m[6] * 2000;
    size = 2000;
    code += m[5] + m[6];
  }
  if (m[7]) {
    const q = +m[7]; // 1=NW, 2=NE, 3=SE, 4=SW, 5=center
    size = 1000;
    if (q === 5) { x += 500; y += 500; }
    else { x += q === 2 || q === 3 ? 1000 : 0; y += q === 1 || q === 2 ? 1000 : 0; }
    code += '.' + m[7];
  }
  return { code, x, y, size };
}

// Label of a grid cell according to its step (100 km, 20 km or 2 km)
function cellLabel(cx, cy, step) {
  const code = dfciFromLambert(cx, cy);
  if (!code) return null;
  return code.slice(0, step >= 100000 ? 2 : step >= 20000 ? 4 : 6);
}

const DFCI = { BOUNDS, toLambert, toLatLng, dfciFromLambert, dfciToLambert, fromLatLng, cellLabel };

if (typeof module !== 'undefined') module.exports = DFCI;
if (typeof window !== 'undefined') window.DFCI = DFCI;
