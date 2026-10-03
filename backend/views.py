import json
import math
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from .routing import search_locations, route_trip, RoutingError
from .planner import build_plan


@require_GET
def health(request):
    return JsonResponse({"status": "ok", "service": "HOS Django API"})


@require_GET
def geocode(request):
    query = request.GET.get("q", "").strip()
    if not 3 <= len(query) <= 200:
        return JsonResponse(
            {"error": "Enter a US city or address (3–200 characters)."}, status=400
        )
    try:
        return JsonResponse({"results": search_locations(query)})
    except RoutingError as exc:
        return JsonResponse({"error": str(exc)}, status=503)


@require_POST
def plan(request):
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError("Expected a JSON object.")
        cycle = float(data.get("cycle_used", 0))
        if not math.isfinite(cycle) or not 0 <= cycle <= 70:
            raise ValueError("Current cycle used must be between 0 and 70 hours.")
        departure = data["departure"]
        date = datetime.fromisoformat(departure)
        if (
            date.tzinfo
            or date.second
            or date.microsecond
            or not 2000 <= date.year <= 2100
        ):
            raise ValueError(
                "Use a local departure date and time, without seconds or a time-zone offset."
            )
        locations = data["locations"]
        if not isinstance(locations, list) or len(locations) != 3:
            raise ValueError("Select current, pickup, and drop-off locations.")
        cleaned = []
        for p in locations:
            lat, lng = float(p["lat"]), float(p["lng"])
            if (
                not math.isfinite(lat)
                or not math.isfinite(lng)
                or not 18 <= lat <= 72
                or not -180 <= lng <= -65
            ):
                raise ValueError("Select valid US map coordinates.")
            label = p["label"].strip()
            if not label or len(label) > 500:
                raise ValueError("Every location needs a valid label.")
            cleaned.append({"lat": lat, "lng": lng, "label": label})
        route = route_trip(cleaned)
        if route["miles"] > 15000:
            raise ValueError("Please plan a trip of less than 15,000 miles.")
        return JsonResponse(build_plan(route, cycle, departure))
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError) as exc:
        return JsonResponse(
            {
                "error": (
                    str(exc)
                    if isinstance(exc, ValueError)
                    else "Check the trip details and try again."
                )
            },
            status=400,
        )
    except RoutingError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
