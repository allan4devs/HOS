import { jsPDF } from "jspdf";
import {
  statuses,
  statusLabels,
  hours,
  dateLabel,
  type Plan,
  type Driver,
} from "./types";

export function buildLogsPdf(plan: Plan, driver: Driver) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  plan.logs.forEach((log, index) => {
    if (index) pdf.addPage();
    pdf.setTextColor(25, 54, 42);
    pdf.setFontSize(10);
    pdf.text("HOS / PROJECTED RECORD OF DUTY STATUS", 15, 17);
    pdf.setFontSize(23);
    pdf.text("Driver’s daily log", 15, 30);
    pdf.setFontSize(11);
    pdf.text(dateLabel(log.date), 195, 29, { align: "right" });
    pdf.setFontSize(9);
    const details = [
      `Driver: ${driver.name || "Not provided"}`,
      `Carrier: ${driver.carrier || "Not provided"}`,
      `Truck / trailer: ${driver.truck || "—"} / ${driver.trailer || "—"}`,
      `Home terminal: ${driver.terminal || "Not provided"}`,
      `Shipping document: ${driver.shipping || "Not provided"}`,
      `Distance: ${log.miles} mi | Total: 24h 00m`,
    ];
    details.forEach((t, i) => pdf.text(t, 15, 42 + i * 7, { maxWidth: 178 }));
    const x = (h: number) => 47 + h * 5.35;
    const y = (s: string) =>
      99 + statuses.indexOf(s as (typeof statuses)[number]) * 12;
    pdf.setDrawColor(195, 204, 196);
    pdf.setLineWidth(0.15);
    for (let i = 0; i <= 96; i++) {
      pdf.line(47 + i * 1.3375, 93, 47 + i * 1.3375, 141);
    }
    pdf.setFontSize(6.5);
    for (let i = 0; i <= 24; i++)
      pdf.text(
        i === 0 || i === 24 ? "M" : i === 12 ? "N" : String(i % 12),
        x(i),
        89,
        { align: "center" },
      );
    statuses.forEach((s, i) => {
      pdf.setFontSize(8);
      pdf.text(statusLabels[i], 15, y(s) + 1);
      pdf.text(hours(log.totals[s]), 179, y(s) + 1);
      pdf.line(47, 93 + i * 12, 175.4, 93 + i * 12);
    });
    pdf.line(47, 141, 175.4, 141);
    pdf.setDrawColor(35, 113, 83);
    pdf.setLineWidth(0.65);
    log.segments.forEach((s, i) => {
      if (i)
        pdf.line(
          x(s.start),
          y(log.segments[i - 1].status),
          x(s.start),
          y(s.status),
        );
      pdf.line(x(s.start), y(s.status), x(s.end), y(s.status));
    });
    let cursor = 154;
    pdf.setTextColor(25, 54, 42);
    pdf.setFontSize(9);
    pdf.text("REMARKS / STATUS CHANGES", 15, cursor);
    cursor += 8;
    log.remarks.forEach((r) => {
      const lines = pdf.splitTextToSize(
        `${r.time}  ${r.label}${r.continued ? " (continued)" : ""} — ${r.place}`,
        178,
      ) as string[];
      if (cursor + lines.length * 4 > 270) {
        pdf.addPage();
        cursor = 20;
        pdf.setFontSize(11);
        pdf.text(`${dateLabel(log.date)} — remarks continued`, 15, cursor);
        cursor += 10;
      }
      pdf.setFontSize(8);
      pdf.text(lines, 15, cursor);
      cursor += lines.length * 4 + 3;
    });
    pdf.setFontSize(7);
    pdf.setTextColor(100);
    pdf.text(
      pdf.splitTextToSize(
        "Projected planning log, not a certified ELD record. Home-terminal wall clock. Outside-trip off duty assumed. Safe stopping facilities and truck restrictions not verified.",
        178,
      ),
      15,
      282,
    );
  });
  pdf.addPage();
  pdf.setTextColor(25, 54, 42);
  pdf.setFontSize(20);
  pdf.text("Trip planning assumptions", 15, 25);
  let cursor = 40;
  pdf.setFontSize(10);
  plan.assumptions.forEach((a) => {
    const lines = pdf.splitTextToSize(`• ${a}`, 178) as string[];
    pdf.text(lines, 15, cursor);
    cursor += lines.length * 5 + 7;
  });
  pdf.setFontSize(8);
  pdf.text(
    "Rule reference: fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations",
    15,
    270,
  );
  return pdf;
}

export function exportLogs(plan: Plan, driver: Driver) {
  const pdf = buildLogsPdf(plan, driver);
  const url = URL.createObjectURL(pdf.output("blob"));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `HOS-logs-${plan.departure.slice(0, 10)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  // Keep the Blob and anchor alive until the browser has started downloading.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 60000);
}
