/* global L, DFCI */

const map = L.map('map').setView([46.6, 2.6], 6);

// crédit de marque dans l'attribution
map.attributionControl.setPrefix(
  '<a class="credit" href="https://gohorus.fr" target="_blank" rel="noopener">Fait avec <span class="heart">❤</span> par Horus</a> · <a href="https://leafletjs.com">Leaflet</a>'
);

// --- Fonds de carte ---

const GEOPF_WMTS =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

const baseLayers = {
  'Plan (OSM)': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }),
  'Ortho IGN': L.tileLayer(GEOPF_WMTS + '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&FORMAT=image/jpeg', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.ign.fr/">IGN</a> / Géoplateforme',
  }),
  'SCAN 25 IGN': L.tileLayer(
    GEOPF_WMTS.replace('/wmts?', '/private/wmts?') +
      '&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&FORMAT=image/jpeg&apikey=ign_scan_ws',
    {
      minZoom: 6,
      maxZoom: 16,
      attribution: '&copy; <a href="https://www.ign.fr/">IGN</a> / Géoplateforme',
    }
  ),
  'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ' +
      '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  }),
};
baseLayers['Plan (OSM)'].addTo(map);
L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

// --- Grille DFCI ---

const gridLayer = L.layerGroup().addTo(map);
const LINE_STYLE = { color: '#f4503a', weight: 1.6, opacity: 0.75, interactive: false };
const SUB_STYLE = { color: '#f4503a', weight: 1.2, opacity: 0.55, interactive: false };
const SEGMENTS = 8; // points intermédiaires : les lignes Lambert sont courbes en Mercator
// Découpage du carré de 2 km en 5 zones. Libellés décalés vers l'angle du quadrant.
const INSET = 380; // m : rapproche les libellés des coins
const ZONES = [
  [INSET, 2000 - INSET, '1'],        // NO
  [2000 - INSET, 2000 - INSET, '2'], // NE
  [2000 - INSET, INSET, '3'],        // SE
  [INSET, INSET, '4'],               // SO
  [1000, 1000, '5'],                 // centre
];

function stepForZoom(z) {
  return z >= 12 ? 2000 : z >= 9 ? 20000 : 100000;
}

// Sous-découpage d'un carré de 2 km : croix (4 quadrants) + carré central (zone 5),
// chaque zone étiquetée avec sa coordonnée DFCI complète (ex. KD40D7.1)
function drawSubdivisions(minX, maxX, minY, maxY) {
  for (let x = minX; x < maxX; x += 2000) {
    for (let y = minY; y < maxY; y += 2000) {
      const code = DFCI.cellLabel(x + 1000, y + 1000, 2000);
      if (!code) continue;
      // croix en 4 branches, chacune s'arrêtant au carré central (à 500 m du bord)
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x + 1000, y), DFCI.toLatLng(x + 1000, y + 500)], SUB_STYLE));
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x + 1000, y + 1500), DFCI.toLatLng(x + 1000, y + 2000)], SUB_STYLE));
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x, y + 1000), DFCI.toLatLng(x + 500, y + 1000)], SUB_STYLE));
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x + 1500, y + 1000), DFCI.toLatLng(x + 2000, y + 1000)], SUB_STYLE));
      // carré central : contour seul, sans remplissage
      gridLayer.addLayer(L.polygon([
        DFCI.toLatLng(x + 500, y + 500), DFCI.toLatLng(x + 1500, y + 500),
        DFCI.toLatLng(x + 1500, y + 1500), DFCI.toLatLng(x + 500, y + 1500),
      ], { ...SUB_STYLE, fill: false }));
      for (const [dx, dy, d] of ZONES) {
        gridLayer.addLayer(L.marker(DFCI.toLatLng(x + dx, y + dy), {
          interactive: false,
          icon: L.divIcon({ className: 'dfci-zone', html: code + '.' + d, iconSize: null }),
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
  // au zoom fin, chaque quadrant affiche déjà sa coordonnée complète : pas de label 2 km séparé
  if (step === 2000 && map.getZoom() >= 14) { drawSubdivisions(minX, maxX, minY, maxY); return; }
  for (let x = minX; x < maxX; x += step) {
    for (let y = minY; y < maxY; y += step) {
      const label = DFCI.cellLabel(x + step / 2, y + step / 2, step);
      if (!label) continue;
      gridLayer.addLayer(
        L.marker(DFCI.toLatLng(x + step / 2, y + step / 2), {
          interactive: false,
          icon: L.divIcon({ className: 'dfci-label', html: label, iconSize: null }),
        })
      );
    }
  }
}

map.on('moveend zoomend', redrawGrid);
redrawGrid();

// --- Recherche inverse : code DFCI → case surlignée ---

let highlight = null;

function clearHighlight() {
  if (highlight) { map.removeLayer(highlight); highlight = null; }
}

// Contour de la case en Lambert, échantillonné (les côtés sont courbes en Mercator)
function cellOutline(x, y, size) {
  const pts = [];
  for (let j = 0; j < SEGMENTS; j++) pts.push(DFCI.toLatLng(x + (size * j) / SEGMENTS, y));
  for (let j = 0; j < SEGMENTS; j++) pts.push(DFCI.toLatLng(x + size, y + (size * j) / SEGMENTS));
  for (let j = 0; j < SEGMENTS; j++) pts.push(DFCI.toLatLng(x + size - (size * j) / SEGMENTS, y + size));
  for (let j = 0; j < SEGMENTS; j++) pts.push(DFCI.toLatLng(x, y + size - (size * j) / SEGMENTS));
  return pts;
}

function zoomForSize(size) {
  return size <= 1000 ? 15 : size <= 2000 ? 14 : size <= 20000 ? 11 : 8;
}

// Centre la carte sur la case décodée et la surligne. Renvoie le code normalisé ou null.
function showDFCI(input) {
  const cell = DFCI.dfciToLambert(input);
  if (!cell) return null;
  clearHighlight();
  highlight = L.polygon(cellOutline(cell.x, cell.y, cell.size), {
    color: '#f6a93b', weight: 3, fillColor: '#f6a93b', fillOpacity: 0.18, interactive: false,
  }).addTo(map);
  map.setView(DFCI.toLatLng(cell.x + cell.size / 2, cell.y + cell.size / 2), zoomForSize(cell.size));
  if (hint) hint.style.opacity = '0';
  return cell.code;
}

const searchCtl = L.control({ position: 'topleft' });
searchCtl.onAdd = () => {
  const div = L.DomUtil.create('div', 'leaflet-bar dfci-search');
  div.innerHTML =
    '<form id="dfci-form">' +
    '<input id="dfci-input" type="text" placeholder="Code DFCI (ex. KD42F7.5)" ' +
    'autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9">' +
    '<button type="submit" title="Rechercher">➜</button>' +
    '</form>';
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
};
searchCtl.addTo(map);

const searchForm = document.getElementById('dfci-form');
const searchInput = document.getElementById('dfci-input');
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = searchInput.value.trim();
  searchInput.classList.remove('invalid');
  if (!val) { clearHighlight(); return; }
  const code = showDFCI(val);
  if (code) {
    searchInput.value = code;
    searchInput.blur();
  } else {
    searchInput.classList.add('invalid');
  }
});

// --- Clic → coordonnées DFCI ---

const hint = document.getElementById('hint');

map.on('click', (e) => {
  if (hint) hint.style.opacity = '0';
  const code = DFCI.fromLatLng(e.latlng.lat, e.latlng.lng);
  const content = code
    ? `<div class="dfci-code">${code}</div>` +
      `<div class="dfci-sub">${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</div>` +
      `<button class="dfci-copy" onclick="copyDFCI('${code}', this)">Copier la coordonnée</button>` +
      `<button class="dfci-copy dfci-share" onclick="shareDFCI('${code}', ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}, this)">Partager</button>`
    : '<div class="dfci-sub">Hors zone DFCI</div>';
  L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
});

// Copie de secours quand l'API Clipboard est indisponible (http, iframe, ancien navigateur)
function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

window.copyDFCI = (code, btn) => {
  const ok = () => { btn.textContent = 'Copié ✓'; };
  const no = () => { btn.textContent = 'Copie impossible'; };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(ok, () => (legacyCopy(code) ? ok() : no()));
  } else {
    legacyCopy(code) ? ok() : no();
  }
};

// --- Partage de position (Web Share, repli : copie du lien) ---

function shareURL(code) {
  return location.origin + location.pathname + '?c=' + encodeURIComponent(code);
}

window.shareDFCI = (code, lat, lng, btn) => {
  const url = shareURL(code);
  const text = `DFCI ${code} — ${lat}, ${lng}`;
  if (navigator.share) {
    navigator.share({ title: 'DFCI ' + code, text, url }).catch(() => {});
  } else {
    const ok = () => { btn.textContent = 'Lien copié ✓'; };
    const no = () => { btn.textContent = 'Partage impossible'; };
    const full = text + '\n' + url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(full).then(ok, () => (legacyCopy(full) ? ok() : no()));
    } else {
      legacyCopy(full) ? ok() : no();
    }
  }
};

// --- Paramètres d'URL : ?c=KD42F7.5 centre la carte sur la case ---

const urlCode = new URLSearchParams(location.search).get('c');
if (urlCode) {
  const code = showDFCI(urlCode);
  if (code && searchInput) searchInput.value = code;
}

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
    posMarker = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#5a7bf0', fillOpacity: 1 }).addTo(map);
    accCircle = L.circle(e.latlng, { radius: e.accuracy, color: '#5a7bf0', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
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
