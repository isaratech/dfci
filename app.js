/* global L, DFCI */

const map = L.map('map').setView([46.6, 2.6], 6);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// --- Grille DFCI ---

const gridLayer = L.layerGroup().addTo(map);
const LINE_STYLE = { color: '#c62828', weight: 1, opacity: 0.7, interactive: false };
const SUB_STYLE = { color: '#c62828', weight: 0.8, opacity: 0.45, interactive: false };
const SEGMENTS = 8; // points intermédiaires : les lignes Lambert sont courbes en Mercator
// Découpage du carré de 2 km en 5 zones : [décalage X, décalage Y, chiffre]
const ZONES = [[500, 1500, '1'], [1500, 1500, '2'], [1500, 500, '3'], [500, 500, '4'], [1000, 1000, '5']];

function stepForZoom(z) {
  return z >= 12 ? 2000 : z >= 9 ? 20000 : 100000;
}

// Sous-découpage d'un carré de 2 km : croix (4 quadrants) + carré central (zone 5)
function drawSubdivisions(minX, maxX, minY, maxY) {
  for (let x = minX; x < maxX; x += 2000) {
    for (let y = minY; y < maxY; y += 2000) {
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x + 1000, y), DFCI.toLatLng(x + 1000, y + 2000)], SUB_STYLE));
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x, y + 1000), DFCI.toLatLng(x + 2000, y + 1000)], SUB_STYLE));
      gridLayer.addLayer(L.polygon([
        DFCI.toLatLng(x + 500, y + 500), DFCI.toLatLng(x + 1500, y + 500),
        DFCI.toLatLng(x + 1500, y + 1500), DFCI.toLatLng(x + 500, y + 1500),
      ], SUB_STYLE));
      for (const [dx, dy, d] of ZONES) {
        gridLayer.addLayer(L.marker(DFCI.toLatLng(x + dx, y + dy), {
          interactive: false,
          icon: L.divIcon({ className: 'dfci-zone', html: d, iconSize: null }),
        }));
      }
    }
  }
}

function redrawGrid() {
  gridLayer.clearLayers();
  const step = stepForZoom(map.getZoom());
  const b = map.getBounds();

  // Emprise Lambert de la vue, échantillonnée sur le pourtour
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i <= 4; i++) {
    const lng = b.getWest() + ((b.getEast() - b.getWest()) * i) / 4;
    const lat = b.getSouth() + ((b.getNorth() - b.getSouth()) * i) / 4;
    for (const [la, ln] of [[b.getSouth(), lng], [b.getNorth(), lng], [lat, b.getWest()], [lat, b.getEast()]]) {
      const [x, y] = DFCI.toLambert(la, ln);
      if (!isFinite(x) || !isFinite(y)) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  minX = Math.max(DFCI.BOUNDS.minX, Math.floor(minX / step) * step);
  minY = Math.max(DFCI.BOUNDS.minY, Math.floor(minY / step) * step);
  maxX = Math.min(DFCI.BOUNDS.maxX, Math.ceil(maxX / step) * step);
  maxY = Math.min(DFCI.BOUNDS.maxY, Math.ceil(maxY / step) * step);
  if (minX >= maxX || minY >= maxY) return;

  for (let x = minX; x <= maxX; x += step) {
    const pts = [];
    for (let j = 0; j <= SEGMENTS; j++) pts.push(DFCI.toLatLng(x, minY + ((maxY - minY) * j) / SEGMENTS));
    gridLayer.addLayer(L.polyline(pts, LINE_STYLE));
  }
  for (let y = minY; y <= maxY; y += step) {
    const pts = [];
    for (let j = 0; j <= SEGMENTS; j++) pts.push(DFCI.toLatLng(minX + ((maxX - minX) * j) / SEGMENTS, y));
    gridLayer.addLayer(L.polyline(pts, LINE_STYLE));
  }

  const cells = ((maxX - minX) / step) * ((maxY - minY) / step);
  if (cells > 400) return; // ponytail: pas d'étiquettes quand la vue en contient trop
  const sub = step === 2000 && map.getZoom() >= 14;
  if (sub) drawSubdivisions(minX, maxX, minY, maxY);
  for (let x = minX; x < maxX; x += step) {
    for (let y = minY; y < maxY; y += step) {
      const label = DFCI.cellLabel(x + step / 2, y + step / 2, step);
      if (!label) continue;
      // sous-découpage visible : code 2 km en haut du carré, pour ne pas masquer la zone 5
      const at = sub ? DFCI.toLatLng(x + step / 2, y + step - 150) : DFCI.toLatLng(x + step / 2, y + step / 2);
      gridLayer.addLayer(
        L.marker(at, {
          interactive: false,
          icon: L.divIcon({ className: 'dfci-label', html: label, iconSize: null }),
        })
      );
    }
  }
}

map.on('moveend zoomend', redrawGrid);
redrawGrid();

// --- Clic → coordonnées DFCI ---

map.on('click', (e) => {
  const code = DFCI.fromLatLng(e.latlng.lat, e.latlng.lng);
  const content = code
    ? `<div class="dfci-code">${code}</div><div class="dfci-sub">${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</div>`
    : 'Hors zone DFCI';
  L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
});

// --- Position GPS ---

let watching = false;
let firstFix = false;
let posMarker = null;
let accCircle = null;
let btn = null;

function stopLocate() {
  map.stopLocate();
  watching = false;
  if (btn) btn.className = 'locate-btn';
  if (posMarker) { map.removeLayer(posMarker); posMarker = null; }
  if (accCircle) { map.removeLayer(accCircle); accCircle = null; }
}

const locateCtl = L.control({ position: 'topleft' });
locateCtl.onAdd = () => {
  const div = L.DomUtil.create('div', 'leaflet-bar');
  btn = L.DomUtil.create('a', 'locate-btn', div);
  btn.href = '#';
  btn.title = 'Ma position';
  btn.innerHTML = '◉';
  L.DomEvent.on(btn, 'click', (e) => {
    L.DomEvent.stop(e);
    if (watching) { stopLocate(); return; }
    watching = true;
    firstFix = true;
    btn.className = 'locate-btn locating';
    // setView géré manuellement (uniquement au 1er fix) pour ne pas recentrer à chaque mise à jour
    map.locate({ watch: true, enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  });
  return div;
};
locateCtl.addTo(map);

map.on('locationfound', (e) => {
  if (!watching) return;
  btn.className = 'locate-btn active';
  if (firstFix) {
    firstFix = false;
    map.setView(e.latlng, Math.max(map.getZoom(), 15));
  }
  if (!posMarker) {
    posMarker = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#1565c0', fillOpacity: 1 }).addTo(map);
    accCircle = L.circle(e.latlng, { radius: e.accuracy, color: '#1565c0', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
    posMarker.bindTooltip('', { permanent: true, direction: 'top', offset: [0, -8], className: 'dfci-pos' });
  }
  posMarker.setLatLng(e.latlng);
  accCircle.setLatLng(e.latlng).setRadius(e.accuracy);
  posMarker.setTooltipContent(DFCI.fromLatLng(e.latlng.lat, e.latlng.lng) || 'Hors zone DFCI');
});

map.on('locationerror', (e) => {
  if (!watching) return;
  stopLocate();
  alert('Position indisponible : ' + e.message);
});

// --- PWA ---

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
