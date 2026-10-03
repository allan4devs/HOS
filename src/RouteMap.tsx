import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { timeLabel, type Plan, type Location } from "./types";

function Fit({ plan }: { plan: Plan | null }) {
  const map = useMap();
  useEffect(() => {
    if (plan)
      map.fitBounds(
        L.latLngBounds(plan.route.geometry.map((p) => [p[1], p[0]])),
        { padding: [48, 48] },
      );
  }, [plan, map]);
  return null;
}
const pin = (text: string, color: string) =>
  L.divIcon({
    html: `<div class="map-pin" style="background:${color}">${text}</div>`,
    className: "custom-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
export function RouteMap({
  plan,
  locations,
}: {
  plan: Plan | null;
  locations: Location[];
}) {
  return (
    <MapContainer
      center={[37.5, -96]}
      zoom={4}
      scrollWheelZoom={false}
      className="route-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit plan={plan} />
      {plan && (
        <>
          <Polyline
            positions={plan.route.geometry.map((p) => [p[1], p[0]])}
            pathOptions={{ color: "#fff", weight: 8, opacity: 0.9 }}
          />
          <Polyline
            positions={plan.route.geometry.map((p) => [p[1], p[0]])}
            pathOptions={{ color: "#237153", weight: 4 }}
          />
          {plan.events
            .filter((e) =>
              ["rest", "restart", "break", "fuel"].includes(e.kind),
            )
            .map((e, i) => (
              <Marker
                key={i}
                position={[e.location[1], e.location[0]]}
                icon={pin(
                  e.kind === "fuel" ? "F" : "R",
                  e.kind === "fuel" ? "#a77730" : "#526a88",
                )}
              >
                <Popup>
                  <strong>{e.label}</strong>
                  <br />
                  {timeLabel(e.start)}
                  <br />
                  Mile {e.mile_marker.toFixed(0)}
                  <br />
                  Estimated route position; verify a safe facility.
                </Popup>
              </Marker>
            ))}
        </>
      )}
      {locations.map((p, i) => (
        <Marker
          key={`${i}-${p.lat}-${p.lng}`}
          position={[p.lat, p.lng]}
          icon={pin(String(i + 1), i === 2 ? "#142b24" : "#237153")}
        >
          <Popup>
            <strong>{["Current location", "Pickup", "Drop-off"][i]}</strong>
            <br />
            {p.label}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
