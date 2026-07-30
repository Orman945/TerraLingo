// The 10-tier "Formulaic Chunks" curriculum from CLAUDE.md, made available at
// runtime so the quest-generation prompt can target a concrete pedagogical
// rule instead of leaving "the curriculum" undefined for the model to guess
// at. Pedagogical rule: the brain cannot retain naked vocabulary, so no tier
// may ever ask the player to say a single, isolated word — every task is
// framed as a short, practical sentence frame ("Formulaic Chunk").
const CURRICULUM_TIERS = [
  {
    level: 1,
    name: "The Parrot",
    rule: "Echoing full, short sentences. Give the player the exact 3-4 word phrase they need to say.",
    example: 'Say "I want a script."',
  },
  {
    level: 2,
    name: "The Mad Libs",
    rule: "Anchor frame + vocabulary swap. Keep the verb the same as Level 1, but ask the player to swap the noun.",
    example: 'Use "I want" + a monster.',
  },
  {
    level: 3,
    name: "The React",
    rule: "Contextual binary. Force listening comprehension by asking the player to agree or disagree with the NPC using a full short sentence.",
    example: 'Reject Mickey\'s idea! Say "No, that is bad."',
  },
  {
    level: 4,
    name: "The Stacker",
    rule: "Noun + Adjective. Expand the phrase by adding descriptive words.",
    example: 'Describe the actor. Say "A very tall man."',
  },
  {
    level: 5,
    name: "The Pivot",
    rule: "Verb swapping. Introduce a new core verb using vocabulary the player already knows.",
    example: 'Tell Mickey you have the script. Say "I have the script."',
  },
  {
    level: 6,
    name: "Time & Place",
    rule: "Add spatial or temporal awareness to sentences the player already knows.",
    example: "Tell Mickey you need the camera now.",
  },
  {
    level: 7,
    name: "The Questioner",
    rule: "Reverse the dynamic. Force the player to ask the NPC a question.",
    example: "Ask Mickey where the actor is.",
  },
  {
    level: 8,
    name: "Emotional State",
    rule: "Expressing feelings or opinions about the context.",
    example: "Tell Mickey you are angry about the lighting.",
  },
  {
    level: 9,
    name: "The Bridge",
    rule: 'Connecting two thoughts with conjunctions (and, but, because).',
    example: "Say you want the dragon, but it is too big.",
  },
  {
    level: 10,
    name: "Improv",
    rule: "Total freedom. Give a contextual goal without providing the exact words.",
    example: "Explain to Mickey why his movie ending is terrible in your own words.",
  },
];

// Clamps to the valid 1-10 range so a bad/missing estimated_level can't
// crash the prompt builder.
function getCurriculumTier(level) {
  const clamped = Math.min(10, Math.max(1, Math.round(level)));
  return CURRICULUM_TIERS[clamped - 1];
}

// Returns the full pedagogical instruction string for a given estimated_level,
// ready to be injected verbatim into the system prompt as [INJECTED_RULE].
function getCurriculumRule(level) {
  const tier = getCurriculumTier(level);
  return `Level ${tier.level} ("${tier.name}"): ${tier.rule} Example: ${tier.example}`;
}

module.exports = { CURRICULUM_TIERS, getCurriculumTier, getCurriculumRule };
