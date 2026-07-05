import { Edge, Node } from "../types";

/**
 * Calculates the shortest path based on TIME (distance/speed).
 * It considers current congestion: if an edge is full, it adds estimated WAIT TIME.
 */
export const findBestPath = (
  startNodeId: string,
  endNodeId: string,
  nodes: Node[],
  edges: Edge[],
  edgeLoads: Record<string, number>,
  edgeWaitTimes: Record<string, number>
): string[] | null => {
  // 2. Build Adjacency List with Weights
  // Weight = distance / speed + (if full ? waitTime : 0)
  const adjacency: Record<string, { node: string; weight: number; edgeId: string }[]> = {};
  nodes.forEach((n) => (adjacency[n.id] = []));

  edges.forEach((edge) => {
    const currentLoad = edgeLoads[edge.id] || 0;
    const isFull = currentLoad >= edge.capacity;

    // Base travel cost (time)
    const travelTime = edge.distance / edge.speed;

    // Additional wait cost if full
    // If we have specific wait time data, use it.
    // Fallback to travelTime implies the edge was filled by a new car (progress 0) so we wait full duration.
    const waitTime = isFull ? (edgeWaitTimes[edge.id] ?? travelTime) : 0;

    const totalWeight = travelTime + waitTime;

    // Add edges to graph. We NO LONGER filter out full edges.
    // We just make them "expensive" based on wait time.

    // Adding Source -> Target
    adjacency[edge.source].push({ node: edge.target, weight: totalWeight, edgeId: edge.id });

    // Adding Target -> Source (Assuming two-way streets for this city map style)
    // In a real graph, we'd check the reverse edge capacity separately if defined.
    // Here we treat the edge object as bidirectional but shared capacity.
    adjacency[edge.target].push({ node: edge.source, weight: totalWeight, edgeId: edge.id });
  });

  // 3. Dijkstra's Algorithm
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const pq: { node: string; priority: number }[] = [];

  nodes.forEach((n) => {
    distances[n.id] = Infinity;
    previous[n.id] = null;
  });

  distances[startNodeId] = 0;
  pq.push({ node: startNodeId, priority: 0 });

  while (pq.length > 0) {
    // Sort by priority (min-heap simulation)
    pq.sort((a, b) => a.priority - b.priority);
    const { node: u } = pq.shift()!;

    if (u === endNodeId) break;

    if (distances[u] === Infinity) break;

    const neighbors = adjacency[u] || [];
    for (const neighbor of neighbors) {
      const alt = distances[u] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = u;
        pq.push({ node: neighbor.node, priority: alt });
      }
    }
  }

  // 4. Reconstruct Path
  const path: string[] = [];
  let u: string | null = endNodeId;

  if (previous[u] === null && u !== startNodeId) {
    return null; // No path found
  }

  while (u !== null) {
    path.unshift(u);
    u = previous[u];
  }

  // The path includes the start node. The vehicle is already AT the start node.
  // We want the sequence of FUTURE nodes.
  return path.slice(1);
};

export const getEdgeId = (n1: string, n2: string, edges: Edge[]): string | null => {
  const edge = edges.find(
    (e) => (e.source === n1 && e.target === n2) || (e.target === n1 && e.source === n2)
  );
  return edge ? edge.id : null;
};
