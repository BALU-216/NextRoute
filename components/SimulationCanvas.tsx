import React, { useMemo } from 'react';
import { CityData, Vehicle } from '../types';

interface SimulationCanvasProps {
  city: CityData;
  vehicles: Vehicle[];
  onNodeClick: (nodeId: string) => void;
  selectedNode: string | null;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ 
  city, 
  vehicles, 
  onNodeClick,
  selectedNode 
}) => {
  
  // Calculate edge utilization for styling
  const edgeUtilization = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicles.forEach(v => {
      if (v.currentEdgeId) {
        counts[v.currentEdgeId] = (counts[v.currentEdgeId] || 0) + 1;
      }
    });
    return counts;
  }, [vehicles]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-2xl border border-slate-700">
      <svg className="w-full h-full" viewBox="0 0 800 600">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="22"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>

        {/* Edges */}
        {city.edges.map((edge) => {
          const startNode = city.nodes.find(n => n.id === edge.source);
          const endNode = city.nodes.find(n => n.id === edge.target);
          if (!startNode || !endNode) return null;

          const load = edgeUtilization[edge.id] || 0;
          const isFull = load >= edge.capacity;
          const ratio = load / edge.capacity;
          
          let strokeColor = "#475569"; // slate-600
          if (ratio > 0.8) strokeColor = "#ef4444"; // red
          else if (ratio > 0.5) strokeColor = "#f59e0b"; // orange
          
          return (
            <g key={edge.id}>
              <line
                x1={startNode.x}
                y1={startNode.y}
                x2={endNode.x}
                y2={endNode.y}
                stroke={strokeColor}
                strokeWidth={isFull ? 6 : 4}
                strokeOpacity={0.6}
                strokeLinecap="round"
              />
              {/* Capacity Indicator Label on Edge */}
              <text 
                x={(startNode.x + endNode.x) / 2} 
                y={(startNode.y + endNode.y) / 2 - 5}
                className="text-[10px] fill-slate-400 font-mono"
                textAnchor="middle"
              >
                {load}/{edge.capacity}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {city.nodes.map((node) => {
          const isSelected = selectedNode === node.id;
          return (
            <g 
              key={node.id} 
              onClick={() => onNodeClick(node.id)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={16}
                fill={isSelected ? "#3b82f6" : "#1e293b"}
                stroke={isSelected ? "#93c5fd" : "#cbd5e1"}
                strokeWidth={3}
              />
              <text
                x={node.x}
                y={node.y}
                dy=".3em"
                textAnchor="middle"
                className="text-xs font-bold fill-white pointer-events-none select-none"
              >
                {node.id}
              </text>
              <text
                x={node.x}
                y={node.y + 28}
                textAnchor="middle"
                className="text-[10px] fill-slate-400 pointer-events-none select-none"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Vehicles */}
        {vehicles.map((vehicle) => {
            if (vehicle.status === 'arrived') return null;
            
            // Interpolate position
            const startNode = city.nodes.find(n => n.id === vehicle.currentNode);
            // If waiting, just stay at start
            if (vehicle.status === 'waiting' || vehicle.status === 'stuck' || !vehicle.nextNode) {
                 if (!startNode) return null;
                 return (
                    <circle
                        key={vehicle.id}
                        cx={startNode.x}
                        cy={startNode.y}
                        r={6}
                        fill={vehicle.color}
                        stroke="#fff"
                        strokeWidth={1}
                    />
                 );
            }

            const targetNode = city.nodes.find(n => n.id === vehicle.nextNode);
            if (!startNode || !targetNode) return null;

            const dx = targetNode.x - startNode.x;
            const dy = targetNode.y - startNode.y;
            const x = startNode.x + dx * vehicle.progress;
            const y = startNode.y + dy * vehicle.progress;

            return (
                <g key={vehicle.id}>
                     <circle
                        cx={x}
                        cy={y}
                        r={8}
                        fill={vehicle.color}
                        stroke="#fff"
                        strokeWidth={2}
                        className="transition-all duration-75 ease-linear"
                    />
                </g>
            );
        })}
      </svg>
    </div>
  );
};

export default SimulationCanvas;
