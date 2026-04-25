/**
 * AI Service for Batch Analysis.
 * Interfaces with OpenRouter to provide expert assessments of process deviations.
 */

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = import.meta.env.VITE_OPENROUTER_BASE_URL || import.meta.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || import.meta.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

export interface AIAssessment {
  hasAnomaly: boolean;
  title: string;
  message: string;
  recommendation: string | null;
  causes: Array<{ variable: string; phase: string }>;
}

/**
 * Fetches an AI assessment for the current state of a batch.
 * @param batchId Unique identifier for the batch.
 * @param currentPct Current progress percentage (0-100).
 * @param drivers List of variables currently showing significant deviations.
 * @param varNames Mapping of technical IDs to human-readable names.
 */
export async function fetchAIAssessment(
  batchId: string, 
  currentPct: number, 
  drivers: any[], 
  varNames: Record<string, string>
): Promise<AIAssessment> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("VITE_OPENROUTER_API_KEY is missing in .env");
  }

  // Construct the prompt for the AI agent
  const prompt = `
Du bist ein industrieller Datenanalyst und 'Golden Batch Detective Agent'.
Analysiere den aktuellen Zustand des Batches '${batchId}' bei Prozessfortschritt ${currentPct}%.

Es wurden folgende kritische Abweichungen vom Golden Profile (Normalverhalten) festgestellt (Z-Score > 2.5):
${drivers.length > 0 
  ? drivers.map(d => `- Parameter: ${varNames[d.variable] || d.variable}, Phase in der es begann: ${d.phase}, Max Z-Score: ${d.maxZ.toFixed(2)}, Spitzenwert: ${d.worstVal?.toFixed(2)} (Erwartet: ${d.worstExpected?.toFixed(2)})`).join('\n') 
  : 'Keine kritischen Abweichungen. Alles verhält sich gemäß dem Golden Profile.'}

Basierend auf diesen Daten, erstelle eine JSON-Antwort mit deiner professionellen Einschätzung.
Sei in deiner Sprache präzise und lösungsorientiert.
Das JSON-Format muss exakt wie folgt sein:
{
  "hasAnomaly": boolean,
  "title": "Ein kurzer, prägnanter Titel der Einschätzung (z.B. Statusbericht, Warnung, Kritischer Fehler)",
  "message": "Ein extrem kurzer Text (maximal 2 Sätze), der den Zustand prägnant beschreibt. Nutze <strong> für Highlights. Nenne konkrete Abweichungen nur, wenn sie kritisch sind.",
  "recommendation": "Deine konkrete, physische Handlungsempfehlung (maximal 1 Satz), falls es Abweichungen gibt. Sonst null.",
  "causes": [ { "variable": "var_id", "phase": "phase_name" } ]
}
`;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: 'Du bist ein hilfreicher Industrie-Agent. Antworte ausschließlich in gültigem JSON.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON from response (robustness against LLM prefixes)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Modell hat kein gültiges JSON zurückgegeben.");
    }
    
    return JSON.parse(jsonMatch[0]) as AIAssessment;
  } catch (error: any) {
    console.error("AI Error:", error);
    
    // Fallback assessment if the API call fails or times out
    return {
      hasAnomaly: drivers.length > 0,
      title: drivers.length > 0 ? "Achtung! Kritische Prozessabweichung erkannt (Fallback)" : "Statusbericht (Fallback):",
      message: `API-Fehler: ${error?.message || 'Unbekannter Fehler'}. Bitte prüfen Sie Ihre Verbindung oder den API-Key.`,
      recommendation: drivers.length > 0 ? "Manuelle Prüfung erforderlich." : null,
      causes: drivers.map(d => ({ variable: d.variable, phase: d.phase }))
    };
  }
}
