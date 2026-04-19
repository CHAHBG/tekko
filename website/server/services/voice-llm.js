import Groq from 'groq-sdk';

let _groq = null;
function getGroq() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

const SYSTEM_PROMPT = `Tu es un extracteur de données pour un assistant de commande vocal.
L'entrée est une transcription de parole française, souvent mal prononcée
ou transcrite approximativement par la Web Speech API.

TU DOIS EXTRAIRE le champ demandé même si l'orthographe est imparfaite.
Retourne TOUJOURS un JSON valide, jamais de texte libre autour.

RÈGLES ABSOLUES :
- Ne jamais redemander un champ si une valeur plausible est présente
- Pour les noms, accepter les approximations phonétiques sénégalaises :
  "baine" → "Baye", "mama dou" → "Mamadou", "fat ma" → "Fatma",
  "ibra" → "Ibrahima", "mo usa" → "Moussa", "seye" → "Sèye",
  "ndiaye" → "Ndiaye", "diallo" → "Diallo", "sow" → "Sow"
- Pour les métiers, accepter les abréviations : "DG" → "Directeur Général",
  "DRH" → "DRH", "comm" → "Commercial", "dev" → "Développeur"
- Si le champ demandé N'EST PAS dans la transcription → retourner
  { "extracted": null, "reason": "not_found" }
  NE PAS inventer une valeur.

FORMAT DE SORTIE :
{
  "extracted": "valeur extraite" | null,
  "reason": "found" | "not_found" | "ambiguous",
  "normalized": "valeur normalisée si différente de l'originale"
}

Exemple input : "je m'appelle baine saare"
Exemple output : { "extracted": "Baye Sarr", "reason": "found", "normalized": "Baye Sarr" }

Exemple input : "mon numéro c'est le vingt-et-un"
Exemple output : { "extracted": null, "reason": "not_found" }`;

const FIELDS = ['fullName', 'phone', 'role', 'company', 'email', 'packKey'];
const REQUIRED = ['fullName', 'phone', 'role', 'packKey'];

export function isGroqConfigured() {
  return !!getGroq();
}

/**
 * Call Groq LLM to extract voice data.
 * @param {{ transcript: string, collectedData: object, stepIndex: number, language: string }} input
 * @returns {Promise<{ extracted: object, nextPrompt: string, complete: boolean }>}
 */
export async function extractVoiceData({ transcript, collectedData, stepIndex, language }) {
  const groq = getGroq();
  if (!groq) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const currentField = FIELDS[stepIndex] || 'fullName';

  const userMessage = `Champ à extraire : "${currentField}"
Transcription vocale : "${transcript}"
Langue de l'utilisateur : ${language}

Extrais la valeur du champ "${currentField}" depuis cette transcription. JSON strict uniquement.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const completion = await groq.chat.completions.create(
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );

    clearTimeout(timeout);

    const raw = completion.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw);

    // New simplified format: { extracted: "value" | null, reason: "...", normalized: "..." }
    let extractedValue = parsed.extracted ?? parsed.normalized ?? null;

    // Wrap in the format the client expects
    const extracted = {};
    if (extractedValue && extractedValue !== 'null' && typeof extractedValue === 'string') {
      extracted[currentField] = extractedValue.trim();
    } else if (extractedValue && typeof extractedValue === 'object') {
      // Handle legacy format where LLM returns { extracted: { fullName: "..." } }
      for (const key of FIELDS) {
        if (extractedValue[key] !== undefined && extractedValue[key] !== null) {
          extracted[key] = String(extractedValue[key]).trim();
        }
      }
    }

    // Validate phone format
    if (extracted.phone) {
      const cleaned = extracted.phone.replace(/[\s\-().]/g, '');
      if (/^\+221[789]\d{8}$/.test(cleaned)) {
        extracted.phone = cleaned;
      } else if (/^[789]\d{8}$/.test(cleaned)) {
        extracted.phone = '+221' + cleaned;
      } else if (/^0[789]\d{8}$/.test(cleaned)) {
        extracted.phone = '+221' + cleaned.slice(1);
      } else if (/^221[789]\d{8}$/.test(cleaned)) {
        extracted.phone = '+' + cleaned;
      } else {
        delete extracted.phone;
      }
    }

    // Validate packKey
    if (extracted.packKey) {
      const normalized = extracted.packKey.toLowerCase().trim();
      if (['starter', 'pro', 'business'].includes(normalized)) {
        extracted.packKey = normalized;
      } else {
        delete extracted.packKey;
      }
    }

    const merged = { ...collectedData, ...extracted };
    const allRequired = REQUIRED.every((f) => merged[f]);

    return {
      extracted,
      nextPrompt: parsed.nextPrompt || '',
      complete: allRequired,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Groq API timeout');
    }
    throw err;
  }
}
