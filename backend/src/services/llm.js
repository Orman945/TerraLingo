// GPT-4o mini — generates Mickey's in-character reply and flags new
// vocabulary the player just used, per the CLAUDE.md prompt-injection rule.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function buildSystemPrompt({ estimatedLevel, vocabularyWords }) {
  const knownWords = vocabularyWords.length > 0 ? vocabularyWords.join(", ") : "(none yet)";

  return `You are "Mickey," an exaggerated, fast-talking Hollywood talent scout NPC in a
language-learning game set on Hollywood Boulevard.

The player is a language learner at estimated level ${estimatedLevel} (1 = beginner, 5 = advanced).
Words the player already knows: ${knownWords}.

Rules:
- Stay strictly in character as Mickey: punchy, energetic, fast-talking showbiz patter.
- Keep your reply to fewer than 3 sentences.
- If the player's transcript has a grammar mistake, naturally model the correct form in your
  reply without lecturing or explicitly pointing out the error.
- Match your vocabulary and sentence complexity to the player's level. You may naturally use
  one or two words the player doesn't know yet so they pick up new vocabulary, but stay
  comprehensible overall.
- STRICT SAFETY: never generate NSFW, violent, or otherwise inappropriate content. Never use
  real celebrity names or likenesses — all names must be fictional.

Respond with JSON only, matching this exact shape:
{ "reply": string, "new_vocab_detected": string[] }

"new_vocab_detected" is the list of notable target-language words or short phrases the PLAYER
used in their transcript (not your own reply) that are not already in their known-words list
above. Lowercase, no punctuation. Return an empty array if there's nothing new.`;
}

async function generateNpcReply({ transcript, estimatedLevel, vocabularyWords }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt({ estimatedLevel, vocabularyWords }) },
        { role: "user", content: transcript },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mickey_reply",
          strict: true,
          schema: {
            type: "object",
            properties: {
              reply: { type: "string" },
              new_vocab_detected: { type: "array", items: { type: "string" } },
            },
            required: ["reply", "new_vocab_detected"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GPT-4o mini chat completion failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    npc_reply_text: parsed.reply,
    new_vocab_detected: parsed.new_vocab_detected,
  };
}

module.exports = { generateNpcReply };
