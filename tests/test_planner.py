import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
import django

django.setup()
from django.test import Client
from backend.planner import build_plan


def route(first, second):
    locations = [
        {"label": name, "lat": lat, "lng": lng}
        for name, lat, lng in [
            ("Chicago", 41.8, -87.6),
            ("Pickup", 39.7, -86.1),
            ("Delivery", 32.7, -96.7),
        ]
    ]
    legs = [
        {
            "seconds": miles / 55 * 3600,
            "miles": miles,
            "geometry": [[-87.6, 41.8], [-96.7, 32.7]],
            "instructions": [],
        }
        for miles in (first, second)
    ]
    return {
        "locations": locations,
        "legs": legs,
        "geometry": [[-87.6, 41.8], [-96.7, 32.7]],
        "miles": first + second,
    }


class PlannerTests(unittest.TestCase):
    def assert_clocks(self, plan, cycle_used):
        drive = uninterrupted = 0
        cycle = cycle_used * 3600
        shift = datetime.fromisoformat(plan["departure"])
        last_end = shift
        for e in plan["events"]:
            start, end = datetime.fromisoformat(e["start"]), datetime.fromisoformat(
                e["end"]
            )
            self.assertLessEqual(abs((start - last_end).total_seconds()), 1)
            last_end = end
            if e["status"] == "driving":
                drive += e["seconds"]
                uninterrupted += e["seconds"]
                self.assertLessEqual(drive, 11 * 3600 + 0.01)
                self.assertLessEqual(uninterrupted, 8 * 3600 + 0.01)
                self.assertLessEqual((end - shift).total_seconds(), 14 * 3600 + 1)
            if e["status"] in ("driving", "on_duty"):
                cycle += e["seconds"]
                self.assertLessEqual(cycle, 70 * 3600 + 0.01)
            if e["status"] != "driving" and e["seconds"] >= 1800:
                uninterrupted = 0
            if e["kind"] in ("rest", "restart"):
                self.assertGreaterEqual(e["seconds"], 10 * 3600)
                drive = uninterrupted = 0
                shift = end
                if e["kind"] == "restart":
                    cycle = 0
        for log in plan["logs"]:
            self.assertAlmostEqual(sum(log["totals"].values()), 24, places=3)
            self.assertEqual(log["segments"][0]["start"], 0)
            self.assertEqual(log["segments"][-1]["end"], 24)
            for a, b in zip(log["segments"], log["segments"][1:]):
                self.assertAlmostEqual(a["end"], b["start"])

    def test_short_trip_no_unnecessary_break(self):
        p = build_plan(route(55, 110), 0, "2026-10-03T08:00")
        self.assertEqual(
            [e["kind"] for e in p["events"]], ["drive", "pickup", "drive", "dropoff"]
        )
        self.assertEqual(p["arrival"], "2026-10-03T13:00:00")
        self.assert_clocks(p, 0)

    def test_pickup_counts_as_driving_break(self):
        p = build_plan(route(440, 110), 0, "2026-10-03T08:00")
        self.assertNotIn("break", [e["kind"] for e in p["events"]])
        self.assert_clocks(p, 0)

    def test_zero_distance_and_full_cycle(self):
        p = build_plan(route(0, 0), 70, "2026-10-03T23:45")
        self.assertEqual(p["events"][0]["kind"], "restart")
        self.assertEqual(p["summary"]["miles"], 0)
        self.assert_clocks(p, 70)

    def test_long_trip_fuel_and_multiple_restarts(self):
        p = build_plan(route(500, 7500), 69.9, "2026-10-03T22:15")
        self.assertGreaterEqual(sum(e["kind"] == "restart" for e in p["events"]), 3)
        fuel = [e for e in p["events"] if e["kind"] == "fuel"]
        self.assertEqual(
            len(fuel), 7
        )  # No refuel after completing the final 1,000 miles.
        for i, e in enumerate(fuel):
            self.assertAlmostEqual(e["mile_marker"], (i + 1) * 1000, places=4)
        self.assertAlmostEqual(sum(e["miles"] for e in p["events"]), 8000, places=5)
        self.assertAlmostEqual(
            sum(l["miles"] for l in p["logs"]), 8000, delta=len(p["logs"]) * 0.051
        )
        self.assert_clocks(p, 69.9)

    def test_many_boundary_inputs(self):
        for cycle in (0, 58, 69, 69.5, 69.99, 70):
            for miles in (0, 1, 440, 605, 1000, 1000.01, 2500):
                with self.subTest(cycle=cycle, miles=miles):
                    self.assert_clocks(
                        build_plan(
                            route(miles / 3, miles * 2 / 3), cycle, "2026-10-03T23:59"
                        ),
                        cycle,
                    )

    def test_api_validation(self):
        client = Client()
        for cycle in (-1, 71, "NaN", "Infinity"):
            response = client.post(
                "/api/plan", {"cycle_used": cycle}, content_type="application/json"
            )
            self.assertEqual(response.status_code, 400)
        self.assertEqual(client.get("/api/plan").status_code, 405)
        self.assertEqual(
            client.post("/api/plan", "[]", content_type="application/json").status_code,
            400,
        )
        self.assertEqual(client.get("/api/health").json()["status"], "ok")
        self.assertEqual(client.get("/api/geocode?q=a").status_code, 400)

    @patch("backend.views.route_trip", return_value=route(55, 110))
    def test_api_full_response(self, _):
        response = Client().post(
            "/api/plan",
            {
                "locations": route(0, 0)["locations"],
                "cycle_used": 0,
                "departure": "2026-10-03T08:00",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["summary"]["miles"], 165)


if __name__ == "__main__":
    unittest.main()
