import { GoogleGenAI, Type } from "@google/genai";
import { CityData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCityMap = async (description: string): Promise<CityData | null> => {
  try {
    const model = "gemini-3-flash-preview";
    const prompt = `Generate a JSON representation of a city map for a traffic simulation based on this description: "${description}".
    
    The map should have 6-12 nodes and 10-20 edges.
    Nodes represent locations (intersections/places).
    Edges represent roads with capacity (1-5), speed (1-10), and logical distance (100-500).
    
    Coordinate space: x between 50 and 750, y between 50 and 550.
    
    Respond with a valid JSON object matching this schema:
    {
      "nodes": [{"id": "string", "x": number, "y": number, "label": "string"}],
      "edges": [{"id": "string", "source": "string", "target": "string", "distance": number, "speed": number, "capacity": number}]
    }`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  label: { type: Type.STRING },
                },
              },
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  distance: { type: Type.NUMBER },
                  speed: { type: Type.NUMBER },
                  capacity: { type: Type.INTEGER },
                },
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    const result = JSON.parse(text) as CityData;
    
    // Validate structure
    if (!result || typeof result !== 'object') return null;
    if (!Array.isArray(result.nodes)) result.nodes = [];
    if (!Array.isArray(result.edges)) result.edges = [];
    
    return result;
  } catch (error) {
    console.error("Failed to generate map:", error);
    return null;
  }
};

export const analyzeTraffic = async (data: any) => {
    try {
        const model = "gemini-3-flash-preview";
        const prompt = `Analyze this traffic simulation snapshot: ${JSON.stringify(data)}. 
        Provide a concise, 2-sentence insight about congestion and flow efficiency.`;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text;
    } catch (e) {
        console.error(e);
        return "Analysis unavailable.";
    }
}