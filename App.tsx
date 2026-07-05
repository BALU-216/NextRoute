import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RefreshCw, Car, Map as MapIcon, RotateCcw, Activity } from 'lucide-react';
import SimulationCanvas from './components/SimulationCanvas';
import { CityData, Vehicle, Node, TrafficStats } from './types';
import { DEFAULT_CITY, SIMULATION_TICK_MS, VEHICLE_COLORS, VEHICLE_SPEED_MULTIPLIER } from './constants';
import { findBestPath, getEdgeId } from './utils/graphUtils';
import { generateCityMap, analyzeTraffic } from './services/geminiService';

const App: React.FC = () => {
  const [city, setCity] = useState<CityData>(DEFAULT_CITY);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mapDescription, setMapDescription] = useState("");
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [trafficInsight, setTrafficInsight] = useState<string | null>(null);

  // Form State
  const [startNodeId, setStartNodeId] = useState<string>(city.nodes?.[0]?.id || '');
  const [endNodeId, setEndNodeId] = useState<string>(city.nodes?.[1]?.id || '');

  // Animation Loop Ref
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  // Ensure city data integrity
  const nodes = city.nodes || [];
  const edges = city.edges || [];

  const deployVehicle = () => {
    if (startNodeId === endNodeId) return;

    const newVehicle: Vehicle = {
      id: Math.random().toString(36).substr(2, 9),
      startNode: startNodeId,
      endNode: endNodeId,
      currentNode: startNodeId,
      targetNode: startNodeId, // Initially targeting itself means it needs to route
      nextNode: null,
      progress: 0,
      path: [],
      color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
      status: 'waiting',
      currentEdgeId: null
    };

    setVehicles(prev => [...prev, newVehicle]);
  };

  const resetSimulation = () => {
    setVehicles([]);
    setIsPlaying(false);
    setTrafficInsight(null);
  };

  const handleGenerateMap = async () => {
    if (!mapDescription.trim()) return;
    setIsGeneratingMap(true);
    resetSimulation();
    const newCity = await generateCityMap(mapDescription);
    if (newCity) {
      setCity({
        nodes: newCity.nodes || [],
        edges: newCity.edges || []
      });
      setStartNodeId(newCity.nodes?.[0]?.id || '');
      setEndNodeId(newCity.nodes?.[1]?.id || '');
    }
    setIsGeneratingMap(false);
  };

  // The Game Loop
  const updateSimulation = useCallback((deltaTime: number) => {
    setVehicles(currentVehicles => {
      const currentEdges = city.edges || [];
      const currentNodes = city.nodes || [];

      // 1. Calculate base edge occupancy and wait times from currently moving vehicles
      const edgeOccupancy: Record<string, Vehicle[]> = {};
      currentVehicles.forEach(v => {
        if (v.status === 'moving' && v.currentEdgeId) {
          if (!edgeOccupancy[v.currentEdgeId]) edgeOccupancy[v.currentEdgeId] = [];
          edgeOccupancy[v.currentEdgeId].push(v);
        }
      });

      const edgeWaitTimes: Record<string, number> = {};
      const dynamicEdgeLoads: Record<string, number> = {};

      currentEdges.forEach(edge => {
        const occupants = edgeOccupancy[edge.id] || [];
        dynamicEdgeLoads[edge.id] = occupants.length;

        if (occupants.length >= edge.capacity) {
            // Find the vehicle closest to finishing to estimate when a slot will open.
            // Higher progress = closer to finish.
            let maxProgress = 0;
            occupants.forEach(v => {
                if (v.progress > maxProgress) maxProgress = v.progress;
            });
            // Remaining time = (1 - progress) * (TotalTime)
            // TotalTime = distance / speed
            edgeWaitTimes[edge.id] = (1 - maxProgress) * (edge.distance / edge.speed);
        } else {
            edgeWaitTimes[edge.id] = 0;
        }
      });
      
      return currentVehicles.map(v => {
        if (v.status === 'arrived') return v;

        // Clone to avoid mutation
        const nextV = { ...v };

        // === WAITING STATE ===
        // Needs a path calculation
        if (nextV.status === 'waiting' || nextV.status === 'stuck') {
          
          // Pass the DYNAMIC loads and WAIT TIMES to findBestPath.
          // This allows Dijkstra to choose between "Wait 2s + Fast Path" vs "Detour 5s".
          const path = findBestPath(
              nextV.currentNode, 
              nextV.endNode, 
              currentNodes, 
              currentEdges, 
              dynamicEdgeLoads,
              edgeWaitTimes
          );
          
          if (path && path.length > 0) {
            const nextTarget = path[0];
            const edgeId = getEdgeId(nextV.currentNode, nextTarget, currentEdges);
            
            if (edgeId) {
                // Check immediate capacity again strictly before switching to 'moving'
                const edge = currentEdges.find(e => e.id === edgeId);
                const currentLoad = dynamicEdgeLoads[edgeId] || 0;
                
                if (edge && currentLoad < edge.capacity) {
                    nextV.path = path;
                    nextV.nextNode = nextTarget;
                    nextV.targetNode = nextTarget; 
                    nextV.currentEdgeId = edgeId;
                    nextV.status = 'moving';
                    nextV.progress = 0;
                    
                    // Update shared load tracker immediately for subsequent vehicles in this loop
                    dynamicEdgeLoads[edgeId] = currentLoad + 1;
                } else {
                    // Path found, but next edge is full. 
                    // Since Dijkstra chose this path, it implies waiting here is better than any detour.
                    // So we stay 'stuck' (waiting) until the edge frees up.
                    nextV.status = 'stuck'; 
                    // Optionally, we could set nextNode/path here to visualize intention,
                    // but keeping it 'waiting' forces re-evaluation next tick which is robust against changing traffic.
                }
            }
          } else if (nextV.currentNode === nextV.endNode) {
              nextV.status = 'arrived';
              nextV.currentEdgeId = null;
          } else {
            nextV.status = 'stuck'; // No path possible
          }
          return nextV;
        }

        // === MOVING STATE ===
        if (nextV.status === 'moving' && nextV.currentEdgeId && nextV.nextNode) {
          const edge = (city.edges || []).find(e => e.id === nextV.currentEdgeId);
          if (edge) {
             // Calculate progress increment
             const moveAmount = (edge.speed * VEHICLE_SPEED_MULTIPLIER) / edge.distance;
             nextV.progress += moveAmount;

             if (nextV.progress >= 1) {
               // ARRIVED AT NEXT NODE
               nextV.currentNode = nextV.nextNode;
               nextV.progress = 0;
               nextV.currentEdgeId = null; 
               
               if (nextV.currentNode === nextV.endNode) {
                 nextV.status = 'arrived';
                 nextV.nextNode = null;
                 nextV.path = [];
               } else {
                 // Needs rerouting from new node
                 nextV.status = 'waiting';
                 nextV.nextNode = null;
               }
             }
          }
        }

        return nextV;
      });
    });
  }, [city]);

  const tick = (time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = time - lastTimeRef.current;

    if (deltaTime > SIMULATION_TICK_MS) {
      updateSimulation(deltaTime);
      lastTimeRef.current = time;
    }
    
    if (isPlaying) {
        requestRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(tick);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = undefined;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, updateSimulation]);

  const getStats = (): TrafficStats => {
    const safeVehicles = vehicles || [];
    const safeEdges = city.edges || [];
    
    const active = safeVehicles.filter(v => v.status === 'moving' || v.status === 'waiting' || v.status === 'stuck').length;
    const completed = safeVehicles.filter(v => v.status === 'arrived').length;
    
    // Simple congestion check
    const edgeCounts: Record<string, number> = {};
    safeVehicles.forEach(v => { if (v.currentEdgeId) edgeCounts[v.currentEdgeId] = (edgeCounts[v.currentEdgeId] || 0) + 1; });
    const congested = safeEdges.filter(e => (edgeCounts[e.id] || 0) >= e.capacity).length;

    return {
        totalVehicles: safeVehicles.length,
        activeVehicles: active,
        completedTrips: completed,
        congestedRoads: congested
    };
  };

  const requestInsight = async () => {
    const stats = getStats();
    setTrafficInsight("Analyzing...");
    const text = await analyzeTraffic(stats);
    setTrafficInsight(text);
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 p-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
                <Car className="text-white h-6 w-6" />
             </div>
             <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                TrafficSim <span className="text-slate-500 text-sm font-normal ml-2">Dynamic Routing Engine</span>
             </h1>
          </div>
          <div className="flex gap-4 items-center">
            {trafficInsight && (
                <div className="hidden md:flex bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 text-xs text-blue-200 animate-pulse">
                    AI Insight: {trafficInsight}
                </div>
            )}
             <button 
                onClick={requestInsight}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
             >
                <Activity size={14} /> Analyze
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Control Panel */}
        <div className="space-y-6">
            
            {/* Simulation Controls */}
            <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Simulation Control</h2>
                    <div className="flex gap-2">
                         <button 
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`p-2 rounded-full transition-colors ${isPlaying ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'}`}
                         >
                            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                         </button>
                         <button 
                            onClick={resetSimulation}
                            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                         >
                            <RotateCcw size={20} />
                         </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                        <div className="text-2xl font-mono text-white">{stats.activeVehicles}</div>
                        <div className="text-[10px] text-slate-500 uppercase">Active</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                        <div className="text-2xl font-mono text-emerald-400">{stats.completedTrips}</div>
                        <div className="text-[10px] text-slate-500 uppercase">Completed</div>
                    </div>
                     <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center col-span-2">
                        <div className={`text-xl font-mono ${stats.congestedRoads > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {stats.congestedRoads}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase">Congested Roads</div>
                    </div>
                </div>

                <div className="space-y-4 border-t border-slate-800 pt-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Start Location</label>
                        <select 
                            value={startNodeId}
                            onChange={(e) => setStartNodeId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.id})</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Destination</label>
                        <select 
                            value={endNodeId}
                            onChange={(e) => setEndNodeId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.id})</option>)}
                        </select>
                     </div>
                     <button 
                        onClick={deployVehicle}
                        disabled={startNodeId === endNodeId}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium transition-colors flex justify-center items-center gap-2"
                     >
                        <Car size={16} /> Deploy Vehicle
                     </button>
                </div>
            </div>

            {/* AI Map Generator */}
            <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-xl">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <MapIcon size={16} /> Map Generator
                </h2>
                <textarea
                    value={mapDescription}
                    onChange={(e) => setMapDescription(e.target.value)}
                    placeholder="e.g., A busy downtown with a bottleneck bridge to the suburbs..."
                    className="w-full h-24 bg-slate-950 border border-slate-700 rounded p-3 text-sm focus:ring-1 focus:ring-purple-500 outline-none resize-none mb-3"
                />
                <button
                    onClick={handleGenerateMap}
                    disabled={isGeneratingMap || !mapDescription}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-2 rounded font-medium transition-colors flex justify-center items-center gap-2"
                >
                    {isGeneratingMap ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" /> Generating...
                        </>
                    ) : (
                        "Generate New City"
                    )}
                </button>
            </div>
        </div>

        {/* Right Map Display */}
        <div className="lg:col-span-2 h-[600px] lg:h-auto">
             <SimulationCanvas 
                city={city} 
                vehicles={vehicles}
                onNodeClick={(id) => setStartNodeId(id)}
                selectedNode={startNodeId}
             />
             <div className="mt-2 text-xs text-slate-500 flex justify-between px-2">
                <span>Click nodes to select start point</span>
                <span className="flex items-center gap-2">
                    <span className="block w-2 h-2 rounded-full bg-slate-600"></span> Free
                    <span className="block w-2 h-2 rounded-full bg-amber-500"></span> Heavy
                    <span className="block w-2 h-2 rounded-full bg-red-500"></span> Full
                </span>
             </div>
        </div>

      </main>
    </div>
  );
};

export default App;