# Four-minute Loom walkthrough

Record the hosted app and your editor with microphone narration. This document is a script, not a completed Loom video.

## 0:00–0:30 — Introduce the app

“This is HOS, a full-stack trip planner built with React and Django. It takes a current location, pickup, drop-off and current cycle usage, and produces a road route, scheduled stops, and projected daily driver logs.”

Show the hosted app at https://hos-flax.vercel.app and the GitHub repository.

## 0:30–1:15 — Plan a real trip

Use the example Chicago → Indianapolis → Dallas trip with zero cycle hours used. Explain that locations can be changed by typing, pressing the search button, and selecting a verified geocoding result. Generate the plan.

Point to distance, driving time, trip duration, fuel stops, and the road line. Click a stop marker. Explain that the markers are estimated road positions and need a safe commercial stopping facility nearby.

## 1:15–2:00 — Explain the schedule

Scroll through pickup, 10-hour rest, fueling, and delivery. Open turn-by-turn directions.

“The scheduler tracks the 11-hour driving limit, 14-hour window, 8-hour break clock, and 70-hour cycle. Pickup and drop-off take an hour on duty. Fueling takes 30 minutes at 1,000-mile intervals. A qualifying pickup or fuel stop also satisfies the driving-break requirement.”

Change cycle usage to 69 hours and regenerate to demonstrate a 34-hour restart. Explain that aggregate cycle usage cannot reveal daily recap credits, so the model does not invent them.

## 2:00–2:45 — Show daily logs

Open Daily log sheets. Change between days, show the four status rows and daily totals, expand driver details, and export the PDF.

“Every sheet covers 24 hours, including segments crossing midnight. These are projected logs with assumed outside-trip off-duty time; they are not certified ELD records. All times use the entered home-terminal clock.”

## 2:45–3:35 — Walk through the code

Show these files:

- `backend/views.py`: validate the request, fetch the route, run the scheduler, return JSON.
- `backend/routing.py`: Nominatim, OSRM, road geometry, and route instructions.
- `backend/planner.py`: independent clock tracking, stop insertion, cycle restarts, and midnight splitting.
- `src/LogSheet.tsx`: SVG graph built from the backend's segments.
- `src/export.ts`: vector PDF generated from the same log data, loaded on demand.

Explain that using shared backend log data avoids differences between map events, the screen, and the PDF.

## 3:35–4:00 — Testing and tradeoffs

Show `tests/test_planner.py` and the passing test command. Mention 42 boundary combinations and a multi-restart 8,000-mile trip.

“The deployment serves both Django and React on Vercel and is connected to GitHub. The free routing service has a car profile, so truck-specific restrictions remain a limitation. For production fleet use, I would add a truck-aware routing provider, verified rest facilities, actual eight-day driver history, and durable storage.”

Stop recording, check the video/audio, and put the actual Loom share link in the assessment submission.
