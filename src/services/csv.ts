import { formatDuration } from "../core";
import type { CloudPracticeResult } from "../types";

const HEADERS = ["Employee", "Script", "Completed", "Duration", "Avg WPM", "Pauses"];

function escapeCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsvRows(results: CloudPracticeResult[]): string[][] {
  const rows = results
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt)
    .map((result) => [
      result.employeeName,
      result.scriptTitle,
      new Date(result.completedAt).toISOString(),
      formatDuration(result.elapsedMs),
      String(result.averageWpm),
      String(result.pauses),
    ]);
  return [HEADERS, ...rows];
}

export function resultsToCsvBlob(rows: string[][]): Blob {
  const csv = rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}
