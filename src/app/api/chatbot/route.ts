import { OpenAI } from 'openai';
import { characterProfiles } from '../../asset/entity/character/general/player/registry';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GAME_MODES = [
  {
    name: "Mochi General Battle",
    description: "A high-intensity boss battle where you face off against the Mochi General. Master your dodging and timing to defeat this powerful foe!",
  },
  {
    name: "Mochi Soldier Surge",
    description: "A survival mode where you must hold out against waves of Mochi Soldiers. How many can you defeat before they overwhelm you?",
  },
  {
    name: "Mochi Soldier Battle",
    description: "A specialized combat arena against Mochi Soldier. A great place to practice your character's combos and abilities.",
  },
  {
    name: "Mada Combat",
    description: "Test your skills in a specialized combat arena against Mada. A great place to practice your character's combos and abilities.",
  },
  {
    name: "Origin",
    description: "A story-driven mode where you follow a narrative, starting with a tutorial and progressing through increasingly difficult stages. At the end, you can gain the password to access Mada Combat.",
  },
];

const GACHA_SYSTEM_INFO = `The Gacha system allows you to spend in-game currency to receive random characters and items. Here's how it works:

**Rates:**
- **Common:** 60%
- **Rare:** 30%
- **Epic:** 8%
- **Legendary:** 2%

**How to Play:**
1.  Earn currency by playing game modes.
2.  Go to the Gacha page and choose a banner.
3.  Spend your currency to pull for a chance to get new characters or powerful items.

**Special Rates:**
From time to time, there are special banners with increased rates for specific characters. Keep an eye out for these events!`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const systemPrompt = `You are a helpful game assistant for "Mochi Game".
You can explain game modes, character skills, and the gacha system.

Available Game Modes:
${GAME_MODES.map(m => `- ${m.name}: ${m.description}`).join('\n')}

${GACHA_SYSTEM_INFO}

Available Characters and Skills:
${characterProfiles.map(p => {
  const skills = p.kit?.skills;
  const basic = p.kit?.basicAttack;
  let s = `- ${p.label}:\n  • Basic: ${basic?.description || 'N/A'}`;
  if (skills) {
    s += `\n  • Q (${skills.q.label}): ${skills.q.description}\n  • E (${skills.e.label}): ${skills.e.description}\n  • R (${skills.r.label}): ${skills.r.description}`;
  }
  return s;
}).join('\n\n')}

Please provide concise and helpful answers. Use markdown for bolding key terms.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
    });

    return new Response(JSON.stringify({ text: response.choices[0].message.content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OpenAI Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from OpenAI' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
