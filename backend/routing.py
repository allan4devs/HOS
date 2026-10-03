"""Free OpenStreetMap geocoding and OSRM routing. Never fabricate routes."""

import math
import os
import threading
import time
from functools import lru_cache
import requests

MILE = 1609.344
_lock = threading.Lock()
_last_geocode = 0.0


class RoutingError(Exception):
    pass


def get_json(url, params=None):
    try:
        response = requests.get(
            url,
            params=params,
            headers={
                "User-Agent": "HOS-Assessment-Planner/1.0 (github.com/allan4devs/HOS)"
            },
            timeout=(5, 20),
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise RoutingError(
            "The free map service is temporarily unavailable. Please try again in a moment."
        ) from exc


@lru_cache(maxsize=512)
def search_locations(query):
    global _last_geocode
    # Explicit searches only; no autocomplete. Serialize and cache per warm instance.
    with _lock:
        time.sleep(max(0, 1.05 - (time.monotonic() - _last_geocode)))
        try:
            results = get_json(
                os.environ.get(
                    "GEOCODER_URL", "https://nominatim.openstreetmap.org/search"
                ),
                {"q": query, "format": "jsonv2", "limit": 5, "countrycodes": "us"},
            )
        finally:
            _last_geocode = time.monotonic()
    return [
        {"label": r["display_name"], "lat": float(r["lat"]), "lng": float(r["lon"])}
        for r in results
    ]


def route_trip(locations):
    coords = ";".join(f"{p['lng']},{p['lat']}" for p in locations)
    data = get_json(
        os.environ.get("ROUTER_URL", "https://router.project-osrm.org")
        + "/route/v1/driving/"
        + coords,
        {"overview": "full", "geometries": "geojson", "steps": "true"},
    )
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError(
            "No road route connects these locations. Choose reachable US locations."
        )
    route = data["routes"][0]
    if len(route["legs"]) != 2:
        raise RoutingError(
            "The map service returned an incomplete route. Please try again."
        )
    legs = []
    for leg in route["legs"]:
        miles = leg["distance"] / MILE
        # OSRM is a passenger-car profile. Limit planning average to 55 mph.
        seconds = max(math.ceil(leg["duration"]), math.ceil(miles / 55 * 3600))
        geometry = []
        instructions = []
        for step in leg["steps"]:
            geometry.extend(step["geometry"]["coordinates"])
            maneuver = step["maneuver"]
            kind = maneuver["type"]
            modifier = maneuver.get("modifier", "")
            road = step.get("name") or step.get("ref") or "the road"
            if kind == "depart":
                instruction = f"Head {modifier} on {road}".replace("  ", " ")
            elif kind == "arrive":
                instruction = "Arrive at your destination"
            elif kind in ("roundabout", "rotary"):
                instruction = f"Enter the roundabout and take exit {maneuver.get('exit', '')} onto {road}"
            else:
                instruction = f"{kind.replace('_', ' ').capitalize()} {modifier} onto {road}".replace(
                    "  ", " "
                )
            instructions.append(
                {
                    "instruction": instruction,
                    "miles": round(step["distance"] / MILE, 2),
                    "location": maneuver["location"],
                }
            )
        legs.append(
            {
                "miles": miles,
                "seconds": seconds,
                "geometry": geometry or [[locations[0]["lng"], locations[0]["lat"]]],
                "instructions": instructions,
            }
        )
    return {
        "miles": sum(l["miles"] for l in legs),
        "geometry": route["geometry"]["coordinates"],
        "legs": legs,
        "source": "OSRM / OpenStreetMap",
        "locations": locations,
    }


def point_at(geometry, fraction):
    """Interpolate along road geometry by distance, not vertex index."""
    if len(geometry) < 2:
        return geometry[0]
    distances = [0.0]
    for a, b in zip(geometry, geometry[1:]):
        lat1, lat2 = math.radians(a[1]), math.radians(b[1])
        h = (
            math.sin((lat2 - lat1) / 2) ** 2
            + math.cos(lat1)
            * math.cos(lat2)
            * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
        )
        distances.append(distances[-1] + 2 * 6371 * math.asin(min(1, math.sqrt(h))))
    target = distances[-1] * min(1, max(0, fraction))
    for i in range(1, len(distances)):
        if distances[i] >= target:
            span = distances[i] - distances[i - 1]
            t = (target - distances[i - 1]) / span if span else 0
            return [
                geometry[i - 1][j] + t * (geometry[i][j] - geometry[i - 1][j])
                for j in (0, 1)
            ]
    return geometry[-1]
