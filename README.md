# Guardians of the Ocean

Coastal restoration web app plus a complementary PWA (Global Impact Ledger). Ten pilot cities, a Three.js globe, Leaflet shoreline maps, GPS compass, install/share, and a first-visit tutorial.

## Run locally

Serve the repo root over HTTP (not `file://`):

```bash
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/`. Mobile / standalone sessions land on the PWA; desktop opens the globe app.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Device-aware entry redirect |
| `save-the-earth (4).html` | Desktop / embed shell (markup + styles) |
| `js/goo-core.js` | Device, sound, notifications |
| `js/goo-compass.js` | GPS heading, elevation, map-ring HUD |
| `js/goo-shell.js` | Install, share, tutorial, service worker |
| `js/goo-globe.js` | Three.js globe |
| `js/goo-cards.js` | Sidebar cards and globe chrome |
| `js/goo-map.js` | Leaflet overlays and phase roadmap |
| `js/pwa-app.js` | PWA clock and tile → 3D/2D loader |
| `css/goo.css` | Shared chrome (toasts, compass, tutorial) |
| `pwa/island-weather-pwa/` | Ledger PWA shell |
| `sw.js` | App-shell cache (network-first navigations) |
| `render.yaml` | Render static site (`guardians-of-the-ocean`) |

Install uses `manifest.webmanifest` (`start_url` is the PWA). Hosted as a static site — not the weott-proposal-engine Render service.
