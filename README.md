# HOS — A better road ahead

A full-stack freight trip planner built with **Django + React + TypeScript**. Enter your current location, pickup, drop-off, and current 70-hour cycle usage to get a road route, estimated stops, turn-by-turn instructions, and projected daily duty-status log sheets.

**Live app:** https://hos-flax.vercel.app  
**Source:** https://github.com/allan4devs/HOS

## Features

- Explicit US address/city search and result selection with free Nominatim geocoding.
- Real OSRM road routes, Leaflet maps, and OpenStreetMap tiles with attribution.
- Deterministic HOS scheduling: 11 hours driving, a 14-hour window, 30-minute interruption after 8 cumulative driving hours, 10-hour daily rest, and conservative 34-hour cycle restarts.
- One hour on duty for pickup and drop-off; 30-minute on-duty fueling at 1,000-mile intervals.
- Multi-day logs split at midnight, continuous SVG duty graphs, daily totals and mileage, and status-change remarks.
- Optional driver/carrier/truck/shipping information and downloadable vector PDF logs for every day.
- Responsive layout, validation, loading/error states, and explicit planning assumptions.

## Run locally

Requirements: Node 22.12+ or 24+, Python 3.12+.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
npm ci
```

Use two terminals:

```powershell
.\.venv\Scripts\python manage.py runserver 127.0.0.1:8000
```

```powershell
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to Django. No database, migrations, API keys, or paid map services are needed. Plans and driver details are held in memory in the browser, and cleared on reload.

## Validation

```powershell
.\.venv\Scripts\python -m unittest discover -v
.\.venv\Scripts\python manage.py check
npm run build
npm audit
git diff --check
```

The suite includes short/zero-distance trips, pickup as a qualifying interruption, full and nearly exhausted cycles, midnight splits, 1,000-mile fuel boundaries, an 8,000-mile trip, and 42 combinations of distance and prior cycle usage. Tests independently verify driving limits, cycle usage, chronological events, and 24-hour log coverage. API tests mock external routing so they are reproducible.

For the real-service browser smoke check, install Chromium with `npx playwright install chromium`, start the local servers, then run `npm run test:browser`. You can instead set `HOS_TEST_URL` to the deployed URL and `HOS_BROWSER_PATH` to an installed Chrome executable. This checks real routing, geocoding, daily logs, PDF download, mobile overflow, cycle restart, and page errors. Public map-service availability can affect this optional check.

## Architecture

```text
React form → POST /api/plan → Django validation
                                  ↓
                             OSRM road route
                                  ↓
                       Pure Python HOS scheduler
                                  ↓
                       Midnight-split daily logs
                                  ↓
                   Leaflet map + SVG logs + PDF
```

- `backend/routing.py`: map services, per-instance cached/serialized geocoding, directions, and distance-based stop positioning.
- `backend/planner.py`: scheduling and daily logs, independent of HTTP and React.
- `backend/views.py`: input validation and JSON endpoints.
- `src/main.tsx`: trip inputs, explicit geocoding selection, tabs, and itinerary.
- `src/RouteMap.tsx`: road geometry and interactive stop markers.
- `src/LogSheet.tsx`: daily SVG graph and log metadata.
- `src/export.ts`: vector PDF generation, loaded only when exporting.
- `tests/test_planner.py`: scheduler invariants and API validation.

### API

- `GET /api/health`
- `GET /api/geocode?q=Atlanta%2C%20Georgia`
- `POST /api/plan`

```json
{
  "locations": [
    { "label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298 },
    { "label": "Indianapolis, IN", "lat": 39.7684, "lng": -86.1581 },
    { "label": "Dallas, TX", "lat": 32.7767, "lng": -96.797 }
  ],
  "cycle_used": 0,
  "departure": "2026-10-03T08:00"
}
```

The response includes `route`, `events`, `logs`, `summary`, `arrival`, `cycle_used_end`, and `assumptions`. Invalid inputs return 400, map-service failures return 503, and unsupported methods return 405.

## Accuracy and assumptions

The rules follow the [FMCSA property-carrying HOS summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations). This is a planning tool, **not a registered ELD or a truck navigation system**.

1. The driver starts with fresh daily clocks after at least 10 consecutive hours off duty. The supplied cycle usage includes all previous on-duty time.
2. Only aggregate cycle usage is available, so daily recap credits cannot be reconstructed. The scheduler conservatively uses 34-hour off-duty restarts rather than inventing prior eight-day history. It does not implement split sleeper berth, short-haul, or adverse-condition exceptions.
3. A full tank is assumed at departure. Fueling takes 30 minutes on duty, and loading/unloading each take one hour. Qualifying non-driving stops reset the 8-hour break clock. All on-duty time consumes cycle availability.
4. Road times use the slower of OSRM's estimate and a 55 mph average. This is an explicit estimate, not live traffic.
5. OSRM's free endpoint uses a **car profile**. Truck height/weight/hazmat restrictions and commercial stopping facilities are not verified. Fuel/rest markers are interpolated estimated positions along the road route. Verify a safe stop nearby before travel.
6. Dates use the entered home-terminal wall clock throughout, without automatic time-zone or DST conversion. Daily logs cover midnight to midnight. Off-duty time before departure and after trip completion is assumed and identified as projected.
7. Carrier, equipment, shipping document, and driver details stay blank unless supplied. Logs have no fabricated driver certification.

### Free map services

See [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/), and [OSRM API documentation](https://project-osrm.org/docs/v5.24.0/api/). Searches happen only on explicit submission, with a descriptive User-Agent, process-local cache, and at least 1.05 seconds between upstream geocoding requests per warm instance. Public demo services have no availability guarantee. Before high-volume use, configure a geocoder with a suitable quota and shared global throttling; serverless process-local throttling alone does not enforce a deployment-wide limit.

Optional server environment variables: `GEOCODER_URL` (complete search URL) and `ROUTER_URL` (OSRM base URL). Credentials are not required for the default services.

## Deployment

The Vercel project `hos` is connected to `allan4devs/HOS`. `vercel.json` builds the Vite assets and Django Python function in one deployment. `/api/*` reaches Django; frontend routes reach `index.html`. The app is stateless and does not write to the serverless filesystem.

```powershell
vercel link --project hos
vercel deploy --prod
```

The repository includes CI for Python tests, Django checks, and the React production build. See [`docs/loom-walkthrough.md`](docs/loom-walkthrough.md) for a 4-minute recording outline. The actual Loom recording/link must be supplied separately.
