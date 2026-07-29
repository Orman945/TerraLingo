// The 10-tier curriculum from CLAUDE.md, made available at runtime so the
// quest-generation prompt can target a concrete grammar tier instead of
// leaving "the curriculum" undefined for the model to guess at.

const CURRICULUM_TIERS = [
  { level: 1, name: "Single Nouns", example: "Sword or shield?" },
  { level: 2, name: "Adjectives", example: "Is the car fast?" },
  { level: 3, name: "Subject + Verb", example: "The car drives." },
  { level: 4, name: "Direct Objects", example: "The actor drives the car." },
  { level: 5, name: "Basic Questions", example: "Where is the car?" },
  { level: 6, name: "Prepositions (Location)", example: "The car is next to the theater." },
  { level: 7, name: "Conjunctions (And/But)", example: "The car is fast, but the bike is slow." },
  { level: 8, name: "Past Tense", example: "The car drove down the boulevard." },
  { level: 9, name: "Future Tense", example: "The car will drive to the premiere." },
  { level: 10, name: "Complex Opinions", example: "I think the car chase scene was overrated." },
];

// Clamps to the valid 1-10 range so a bad/missing estimated_level can't
// crash the prompt builder.
function getCurriculumTier(level) {
  const clamped = Math.min(10, Math.max(1, Math.round(level)));
  return CURRICULUM_TIERS[clamped - 1];
}

module.exports = { CURRICULUM_TIERS, getCurriculumTier };
