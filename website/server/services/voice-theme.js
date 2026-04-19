/**
 * Theme suggestion heuristic — zero LLM cost.
 * Maps role/company keywords to the 4 Tapal themes.
 */

const THEME_RULES = [
  {
    theme: 'executive',
    label: 'Executive Noir',
    accent: '#d4a147',
    material: 'Brushed metal',
    finish: 'Soft matte',
    foil: 'Gold foil',
    keywords: ['finance', 'banque', 'avocat', 'droit', 'directeur', 'pdg', 'dg', 'consulting', 'notaire', 'comptable', 'audit', 'manager', 'ceo', 'cfo', 'lawyer', 'attorney', 'banker'],
  },
  {
    theme: 'pulse',
    label: 'Pulse Tech',
    accent: '#2bd1ff',
    material: 'Frosted black',
    finish: 'Gloss',
    foil: 'Silver foil',
    keywords: ['tech', 'startup', 'dev', 'ingénieur', 'fintech', 'digital', 'web', 'app', 'développeur', 'software', 'engineer', 'developer', 'it', 'data', 'programmeur', 'informatique'],
  },
  {
    theme: 'teranga',
    label: 'Teranga Warm',
    accent: '#8e6f48',
    material: 'Pearl white',
    finish: 'Satin',
    foil: 'Copper foil',
    keywords: ['restaurant', 'hôtel', 'traiteur', 'santé', 'éducation', 'artisan', 'médecin', 'docteur', 'infirmier', 'pharmacien', 'enseignant', 'professeur', 'chef', 'cuisinier', 'hospitality', 'hotel', 'health', 'teacher'],
  },
  {
    theme: 'studio',
    label: 'Studio Editorial',
    accent: '#ff6b2c',
    material: 'Soft touch PVC',
    finish: 'Matte',
    foil: 'No foil',
    keywords: ['designer', 'photo', 'créatif', 'agence', 'communication', 'mode', 'graphiste', 'photographe', 'vidéaste', 'artist', 'creative', 'fashion', 'media', 'journaliste'],
  },
];

/**
 * Suggest a theme based on role and company text.
 * @param {{ role: string, company?: string }} profile
 * @returns {{ theme: string, label: string, accent: string, material: string, finish: string, foil: string }}
 */
export function suggestTheme({ role, company }) {
  const text = `${role ?? ''} ${company ?? ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let bestMatch = null;
  let bestScore = 0;

  for (const rule of THEME_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      const normalized = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (text.includes(normalized)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  // Default to Executive Noir
  const chosen = bestMatch ?? THEME_RULES[0];

  return {
    theme: chosen.theme,
    label: chosen.label,
    accent: chosen.accent,
    material: chosen.material,
    finish: chosen.finish,
    foil: chosen.foil,
  };
}
