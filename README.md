# DFCI viewer

Carte [Leaflet](https://leafletjs.com) avec carroyage DFCI (Défense de la Forêt Contre les Incendies). PWA 100 % client, sans build, sans backend. Hébergée sur [dfci.app](https://dfci.app).

- **Grille DFCI** superposée à la carte (100 km / 20 km / 2 km selon le zoom), avec étiquettes.
- **Clic sur la carte** → coordonnées DFCI du point (ex. `KD42F7.5`) + lat/lon.
- **Recherche inverse** : saisir un code DFCI (complet ou partiel, ex. `KD42F7.5` ou `KD42`) → la carte se centre sur la case et la surligne.
- **Fonds de carte** au choix : OSM, orthophotos IGN, SCAN 25 IGN (Géoplateforme) et OpenTopoMap.
- **Partage** : bouton « Partager » (Web Share, repli copie de lien) ; les liens `?c=KD42F7.5` ouvrent l'app centrée sur la case.
- **Bouton ◉** → position GPS de l'utilisateur avec son code DFCI.
- **Installable** (PWA) ; l'app fonctionne hors-ligne, les fonds de carte nécessitent le réseau.

## Carroyage DFCI

Grille kilométrique en projection Lambert II étendu (EPSG:27572), normalisée pour la lutte contre les feux de forêt :

1. carrés de **100 km** : 2 lettres (`A`–`N`, sans `I` ni `J`), origine X=0 / Y=1 600 000 ;
2. carrés de **20 km** : 2 chiffres pairs (`0`–`8`) ;
3. carrés de **2 km** : 1 lettre (`A`–`L`, sans `I` ni `J`) + 1 chiffre ;
4. découpage du carré de 2 km en 5 zones : `1`=NO, `2`=NE, `3`=SE, `4`=SO, `5`=centre.

Algorithme (encodage et décodage) dans [dfci.js](dfci.js), conversion WGS84 → Lambert II étendu via [proj4js](https://github.com/proj4js/proj4js).

## Développement

Fichiers statiques, aucun outillage :

```sh
python3 -m http.server 8000   # puis http://localhost:8000
node test.js                  # vérifie l'algorithme DFCI
```

## Déploiement

Copier le contenu du dépôt sur n'importe quel hébergement statique servi en HTTPS (requis pour la géolocalisation et le service worker).

## Licence

[MIT](LICENSE). Fonds de carte © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright), © [IGN](https://www.ign.fr/) / Géoplateforme, © [OpenTopoMap](https://opentopomap.org) (CC-BY-SA).
