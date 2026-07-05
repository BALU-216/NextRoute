export interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  distance: number; // Logical distance
  speed: number; // Speed limit (units per tick)
  capacity: number; // Max vehicles
}

export interface Vehicle {
  id: string;
  startNode: string;
  endNode: string;
  currentNode: string; // The node currently at or just left
  targetNode: string; // The immediate next node in path
  nextNode: string | null; // The node moving towards (redundant with targetNode usually, but used for interpolation)
  progress: number; // 0 to 1 along the current edge
  path: string[]; // Remaining sequence of Node IDs to visit
  color: string;
  status: "waiting" | "moving" | "arrived" | "stuck";
  currentEdgeId: string | null;
}

export interface TrafficStats {
  totalVehicles: number;
  activeVehicles: number;
  completedTrips: number;
  congestedRoads: number;
}

export interface CityData {
  nodes: Node[];
  edges: Edge[];
}
