// Replaced keyword-based parser with Gemini API
import { NeedCategory, Urgency } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type ParsedNeed = {
  category: NeedCategory;
  urgency: Urgency;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  peopleAffected: number | null;
  requiredSkills: string[];
};

export async function parseUnstructuredText(text: string): Promise<ParsedNeed> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not found, falling back to keyword parsing");
    return parseFallback(text);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || "gemini-pro";
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
Extract the following information from the text and return it as a pure JSON object.
Do not include \`\`\`json or any markdown formatting, just the raw JSON representing the type ParsedNeed.

The interface looks like this:
{
  "category": "MEDICAL" | "SUPPLY" | "FOOD" | "SHELTER" | "TRANSPORT" | "COUNSELING" | "OTHER",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "locationLabel": string | null,
  "latitude": number | null,
  "longitude": number | null,
  "peopleAffected": number | null,
  "requiredSkills": string[] // e.g. ["Medical", "First Aid", "Logistics", "Cooking", "Construction", "Driving", "Counseling", "General"]
}

Text to parse:
"""
${text}
"""
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    // remove markdown if gemini puts it anyway
    const jsonStr = responseText.replace(/```json\n/g, "").replace(/```\n?/g, "");
    const data = JSON.parse(jsonStr);

    return {
      category: data.category || "OTHER",
      urgency: data.urgency || "MEDIUM",
      locationLabel: data.locationLabel || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      peopleAffected: data.peopleAffected || null,
      requiredSkills: Array.isArray(data.requiredSkills) ? data.requiredSkills : ["General"],
    };
  } catch (err) {
    console.error("Gemini ingestion failed:", err);
    return parseFallback(text);
  }
}

function parseFallback(text: string): ParsedNeed {
  const lower = text.toLowerCase();

  const category: NeedCategory =
    /blanket|cloth|supply|kit|tent/.test(lower)        ? "SUPPLY"     :
    /medic|injur|wound|doctor|ambulance/.test(lower)   ? "MEDICAL"    :
    /food|meal|water|hungry/.test(lower)               ? "FOOD"       :
    /shelter|homeless|roof/.test(lower)                ? "SHELTER"    :
    /transport|ride|pickup/.test(lower)                ? "TRANSPORT"  :
    /counsel|trauma|mental/.test(lower)                ? "COUNSELING" :
                                                         "OTHER";

  const urgency: Urgency =
    /critical|immediately|dying|emergency/.test(lower) ? "CRITICAL" :
    /urgent|asap|today|now/.test(lower)                ? "HIGH"     :
    /soon|tomorrow|this week/.test(lower)              ? "MEDIUM"   :
                                                         "LOW";

  const peopleMatch = text.match(/(\d+)\s+(families|people|persons|kids|children)/i);
  const peopleAffected = peopleMatch ? parseInt(peopleMatch[1], 10) : null;

  const locMatch = text.match(/\b(?:on|at|near)\s+([A-Z][\w\s]+?)(?:[.,]|$)/);
  const locationLabel = locMatch ? locMatch[1].trim() : null;

  const skillMap: Record<NeedCategory, string[]> = {
    MEDICAL:    ["Medical", "First Aid"],
    SUPPLY:     ["Logistics"],
    FOOD:       ["Logistics", "Cooking"],
    SHELTER:    ["Logistics", "Construction"],
    TRANSPORT:  ["Driving"],
    COUNSELING: ["Counseling"],
    OTHER:      ["General"],
  };

  return {
    category,
    urgency,
    locationLabel,
    latitude: null,    // No geocoding in MVP — route falls back to reporter coords.
    longitude: null,
    peopleAffected,
    requiredSkills: skillMap[category],
  };
}
