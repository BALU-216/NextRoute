import { CityData } from "./types";

export const SIMULATION_TICK_MS = 50;
export const VEHICLE_SPEED_MULTIPLIER = 0.5;

export const DEFAULT_CITY: CityData = {
  nodes: [
    { id: "A", x: 100, y: 100, label: "Downtown" },
    { id: "B", x: 300, y: 50, label: "Uptown" },
    { id: "C", x: 500, y: 150, label: "Suburbs" },
    { id: "D", x: 200, y: 300, label: "Industrial" },
    { id: "E", x: 600, y: 400, label: "Airport" },
    { id: "F", x: 400, y: 250, label: "Midtown" },
  ],
  edges: [
    { id: "e1", source: "A", target: "B", distance: 200, speed: 5, capacity: 2 },
    { id: "e2", source: "B", target: "C", distance: 250, speed: 8, capacity: 3 },
    { id: "e3", source: "A", target: "D", distance: 220, speed: 4, capacity: 2 },
    { id: "e4", source: "D", target: "F", distance: 150, speed: 6, capacity: 1 }, // Low capacity!
    { id: "e5", source: "B", target: "F", distance: 180, speed: 5, capacity: 2 },
    { id: "e6", source: "F", target: "C", distance: 160, speed: 6, capacity: 2 },
    { id: "e7", source: "C", target: "E", distance: 300, speed: 10, capacity: 4 }, // Highway
    { id: "e8", source: "F", target: "E", distance: 280, speed: 7, capacity: 2 },
    { id: "e9", source: "D", target: "E", distance: 400, speed: 9, capacity: 3 },
  ],
};

export const VEHICLE_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
];
