"""Deterministic property-carrying 70/8 planning, in seconds.

Only aggregate prior cycle usage is supplied, so hours are never recapped based
on invented history: a conservative 34-hour restart restores cycle availability.
Daily clocks start fresh after an assumed 10-hour pre-trip rest.
"""

from datetime import datetime, timedelta
from .routing import point_at

HOUR = 3600
EPS = 0.00001


def build_plan(route, cycle_used, departure):
    now = datetime.fromisoformat(departure)
    trip_start = now
    events = []
    shift_start = now
    driving = since_break = 0.0
    cycle = cycle_used * HOUR
    fuel_miles = total_miles = 0.0
    position = [route["locations"][0]["lng"], route["locations"][0]["lat"]]
    place = route["locations"][0]["label"]

    def add(status, seconds, kind, label, miles=0.0, end_position=None):
        nonlocal now, driving, since_break, cycle, total_miles, fuel_miles, position
        if seconds <= EPS:
            return
        start = now
        now += timedelta(seconds=seconds)
        events.append(
            {
                "status": status,
                "kind": kind,
                "label": label,
                "start": start.isoformat(timespec="seconds"),
                "end": now.isoformat(timespec="seconds"),
                "seconds": seconds,
                "miles": miles,
                "mile_marker": total_miles,
                "location": position[:],
                "place": place,
            }
        )
        if status in ("driving", "on_duty"):
            cycle += seconds
        if status == "driving":
            driving += seconds
            since_break += seconds
            total_miles += miles
            fuel_miles += miles
        elif seconds >= 30 * 60:
            since_break = 0
        if end_position is not None:
            position = end_position

    def rest(restart=False):
        nonlocal driving, since_break, cycle, shift_start
        add(
            "off_duty",
            (34 if restart else 10) * HOUR,
            "restart" if restart else "rest",
            "34-hour cycle restart" if restart else "10-hour off-duty rest",
        )
        driving = since_break = 0
        shift_start = now
        if restart:
            cycle = 0

    def service(seconds, kind, label):
        if cycle + seconds > 70 * HOUR + EPS:
            rest(True)
        elif (now - shift_start).total_seconds() + seconds > 14 * HOUR + EPS:
            rest()
        add("on_duty", seconds, kind, label)

    for leg_index, leg in enumerate(route["legs"]):
        completed = 0.0
        while completed < leg["seconds"] - EPS:
            if cycle >= 70 * HOUR - EPS:
                rest(True)
                continue
            if (
                driving >= 11 * HOUR - EPS
                or (now - shift_start).total_seconds() >= 14 * HOUR - EPS
            ):
                rest()
                continue
            if fuel_miles >= 1000 - EPS:
                service(30 * 60, "fuel", "Fuel stop · 30 minutes")
                fuel_miles = 0
                continue
            if since_break >= 8 * HOUR - EPS:
                if (now - shift_start).total_seconds() + 30 * 60 >= 14 * HOUR - EPS:
                    rest()
                else:
                    add("off_duty", 30 * 60, "break", "30-minute driving break")
                continue
            fuel_seconds = (
                (1000 - fuel_miles) / leg["miles"] * leg["seconds"]
                if leg["miles"] > EPS
                else float("inf")
            )
            seconds = min(
                leg["seconds"] - completed,
                11 * HOUR - driving,
                8 * HOUR - since_break,
                14 * HOUR - (now - shift_start).total_seconds(),
                70 * HOUR - cycle,
                fuel_seconds,
            )
            end_position = point_at(
                leg["geometry"], (completed + seconds) / leg["seconds"]
            )
            miles = leg["miles"] * seconds / leg["seconds"] if leg["seconds"] else 0
            add(
                "driving",
                seconds,
                "drive",
                "Drive to pickup" if leg_index == 0 else "Drive to drop-off",
                miles,
                end_position,
            )
            completed += seconds
            place = f"Along route · mile {total_miles:,.0f}"
        destination = route["locations"][leg_index + 1]
        position = [destination["lng"], destination["lat"]]
        place = destination["label"]
        service(
            HOUR,
            "pickup" if leg_index == 0 else "dropoff",
            "Pickup · 1 hour" if leg_index == 0 else "Drop-off · 1 hour",
        )
    logs = daily_logs(events, trip_start, now)
    return {
        "route": route,
        "events": events,
        "logs": logs,
        "departure": trip_start.isoformat(timespec="seconds"),
        "arrival": now.isoformat(timespec="seconds"),
        "cycle_used_end": round(cycle / HOUR, 2),
        "summary": {
            "miles": round(total_miles, 1),
            "driving_hours": round(
                sum(e["seconds"] for e in events if e["status"] == "driving") / HOUR, 2
            ),
            "elapsed_hours": round((now - trip_start).total_seconds() / HOUR, 2),
            "days": len(logs),
            "fuel_stops": sum(e["kind"] == "fuel" for e in events),
            "rests": sum(e["kind"] in ("rest", "restart", "break") for e in events),
        },
        "assumptions": [
            "Fresh 11-hour driving and 14-hour duty clocks after 10 hours off duty before departure.",
            "70 hours / 8 days. Prior daily history is unknown; no recap credits are assumed. A 34-hour restart restores the cycle.",
            "Full fuel tank at departure; 30-minute on-duty fuel stops at 1,000-mile intervals.",
            "Pickup and drop-off each take 1 hour on duty. All 30-minute non-driving stops satisfy the driving-break requirement.",
            "Driving estimates use the slower of OSRM travel time or a 55 mph average. No traffic or adverse conditions.",
            "All logs use the entered home-terminal wall clock; no time-zone conversion is applied.",
            "OSRM uses a car road profile: truck restrictions and safe stopping facilities are not verified. Stops are estimated route positions.",
            "Off-duty time outside this planned trip is assumed. These are projected logs, not certified ELD records.",
        ],
    }


def daily_logs(events, start, end):
    logs = []
    day = start.replace(hour=0, minute=0, second=0, microsecond=0)
    while day < end:
        next_day = day + timedelta(days=1)
        segments = []
        cursor = day
        miles = 0.0
        remarks = []
        for event in events:
            a, b = datetime.fromisoformat(event["start"]), datetime.fromisoformat(
                event["end"]
            )
            left, right = max(a, day), min(b, next_day)
            if right <= left:
                continue
            if left > cursor:
                segments.append(
                    {
                        "status": "off_duty",
                        "start": (cursor - day).total_seconds() / HOUR,
                        "end": (left - day).total_seconds() / HOUR,
                    }
                )
            segments.append(
                {
                    "status": event["status"],
                    "start": (left - day).total_seconds() / HOUR,
                    "end": (right - day).total_seconds() / HOUR,
                }
            )
            miles += event["miles"] * (right - left).total_seconds() / event["seconds"]
            remarks.append(
                {
                    "time": left.strftime("%H:%M"),
                    "label": event["label"],
                    "place": event["place"],
                    "continued": a < day,
                }
            )
            cursor = right
        if cursor < next_day:
            segments.append(
                {
                    "status": "off_duty",
                    "start": (cursor - day).total_seconds() / HOUR,
                    "end": 24,
                }
            )
        totals = {
            status: round(
                sum(s["end"] - s["start"] for s in segments if s["status"] == status), 4
            )
            for status in ("off_duty", "sleeper", "driving", "on_duty")
        }
        logs.append(
            {
                "date": day.date().isoformat(),
                "segments": segments,
                "totals": totals,
                "miles": round(miles, 1),
                "remarks": remarks,
            }
        )
        day = next_day
    return logs
