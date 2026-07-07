/* global L, DFCI */

const map = L.map('map').setView([46.6, 2.6], 6);

// brand credit in the attribution
map.attributionControl.setPrefix(
  '<a class="credit" href="https://gohorus.fr" target="_blank" rel="noopener">Fait avec <span class="heart">❤</span> par Horus</a> · <a href="https://leafletjs.com">Leaflet</a>'
);

// --- Base layers ---

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

// --- DFCI grid ---

const gridLayer = L.layerGroup().addTo(map);
const LINE_STYLE = { color: '#f4503a', weight: 2.4, opacity: 0.75, interactive: false };
const SUB_STYLE = { color: '#f4503a', weight: 1.8, opacity: 0.55, interactive: false };
const SEGMENTS = 8; // intermediate points: Lambert lines are curved in Mercator
// Split of the 2 km square into 5 zones. Labels shifted towards the quadrant corner.
const INSET = 380; // m: moves the labels closer to the corners
const ZONES = [
  [INSET, 2000 - INSET, '1'],        // NW
  [2000 - INSET, 2000 - INSET, '2'], // NE
  [2000 - INSET, INSET, '3'],        // SE
  [INSET, INSET, '4'],               // SW
  [1000, 1000, '5'],                 // center
];

function stepForZoom(z) {
  return z >= 12 ? 2000 : z >= 9 ? 20000 : 100000;
}

// Subdivision of a 2 km square: cross (4 quadrants) + central square (zone 5),
// each zone labeled with its full DFCI coordinate (e.g. KD40D7.1)
function drawSubdivisions(minX, maxX, minY, maxY) {
  for (let x = minX; x < maxX; x += 2000) {
    for (let y = minY; y < maxY; y += 2000) {
      const code = DFCI.cellLabel(x + 1000, y + 1000, 2000);
      if (!code) continue;
      // cross with 4 arms, each stopping at the central square (500 m from the edge)
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x + 1000, y), DFCI.toLatLng(x + 1000, y + 500)], SUB_STYLE));
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x + 1000, y + 1500), DFCI.toLatLng(x + 1000, y + 2000)], SUB_STYLE));
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x, y + 1000), DFCI.toLatLng(x + 500, y + 1000)], SUB_STYLE));
      gridLayer.addLayer(L.polyline([DFCI.toLatLng(x + 1500, y + 1000), DFCI.toLatLng(x + 2000, y + 1000)], SUB_STYLE));
      // central square: outline only, no fill
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

  // Lambert extent of the view, sampled along the perimeter
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
  if (cells > 400) return; // ponytail: no labels when the view contains too many
  // at fine zoom, each quadrant already shows its full coordinate: no separate 2 km label
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

// --- Reverse search: DFCI code → highlighted cell ---

let highlight = null;

function clearHighlight() {
  if (highlight) { map.removeLayer(highlight); highlight = null; }
}

// Cell outline in Lambert, sampled (the sides are curved in Mercator)
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

// Centers the map on the decoded cell and highlights it. Returns the normalized code or null.
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

// --- Click → DFCI coordinates ---

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

// Fallback copy when the Clipboard API is unavailable (http, iframe, old browser)
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

// --- Position sharing (Web Share, fallback: copy the link) ---

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

// --- URL parameters: ?c=KD42F7.5 centers the map on the cell ---

const urlCode = new URLSearchParams(location.search).get('c');
if (urlCode) {
  const code = showDFCI(urlCode);
  if (code && searchInput) searchInput.value = code;
}

// --- GPS position ---

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
  // "My location" icon (Material Design): filled crosshair, the de facto standard on maps
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/></svg>';
  L.DomEvent.on(btn, 'click', (e) => {
    L.DomEvent.stop(e);
    if (watching) { stopLocate(); return; }
    watching = true;
    firstFix = true;
    btn.className = 'locate-btn locating';
    // setView handled manually (only on the 1st fix) to avoid recentering on every update
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed:', err));
}

// Install button: Chrome no longer shows an automatic banner (beforeinstallprompt
// must be handled manually) and iOS Safari has no prompt at all.
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let installPrompt = null;
let installBtn = null;

const installCtl = L.control({ position: 'topleft' });
installCtl.onAdd = () => {
  const div = L.DomUtil.create('div', 'leaflet-bar install-ctl');
  installBtn = L.DomUtil.create('a', 'install-btn', div);
  installBtn.href = '#';
  installBtn.title = "Installer l'application";
  installBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M12 3v11"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>';
  L.DomEvent.on(installBtn, 'click', async (e) => {
    L.DomEvent.stop(e);
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      installPrompt = null;
      if (outcome === 'accepted') hideInstallBtn();
    } else if (isIOS) {
      alert("Pour installer l'application :\n\n1. Touchez le bouton Partager (carré avec une flèche)\n2. Choisissez « Sur l'écran d'accueil »");
    }
  });
  return div;
};

function hideInstallBtn() {
  if (installBtn) installBtn.parentElement.style.display = 'none';
}

if (!isStandalone) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (!installBtn) installCtl.addTo(map);
  });
  // iOS never fires beforeinstallprompt: always offer the button with instructions
  if (isIOS) installCtl.addTo(map);
  window.addEventListener('appinstalled', hideInstallBtn);
}
