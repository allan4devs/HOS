export type Location = { label: string; lat: number; lng: number };
export type Status = "off_duty" | "sleeper" | "driving" | "on_duty";
export type Log = {
  date: string;
  miles: number;
  segments: { status: Status; start: number; end: number }[];
  totals: Record<Status, number>;
  remarks: { time: string; label: string; place: string; continued: boolean }[];
};
export type Event = {
  status: Status;
  kind: string;
  label: string;
  start: string;
  end: string;
  seconds: number;
  miles: number;
  mile_marker: number;
  location: [number, number];
  place: string;
};
export type Plan = {
  departure: string;
  arrival: string;
  cycle_used_end: number;
  assumptions: string[];
  events: Event[];
  logs: Log[];
  summary: {
    miles: number;
    driving_hours: number;
    elapsed_hours: number;
    days: number;
    fuel_stops: number;
    rests: number;
  };
  route: {
    geometry: [number, number][];
    locations: Location[];
    source: string;
    legs: {
      miles: number;
      seconds: number;
      instructions: { instruction: string; miles: number }[];
    }[];
  };
};
export type Driver = {
  name: string;
  carrier: string;
  truck: string;
  trailer: string;
  shipping: string;
  terminal: string;
};
export const statuses: Status[] = ["off_duty", "sleeper", "driving", "on_duty"];
export const statusLabels = ["Off duty", "Sleeper berth", "Driving", "On duty"];
export const hours = (n: number) => {
  const m = Math.round(n * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
export const dateLabel = (s: string) =>
  new Date(`${s.slice(0, 10)}T12:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const timeLabel = (s: string) => `${dateLabel(s)} · ${s.slice(11, 16)}`;
