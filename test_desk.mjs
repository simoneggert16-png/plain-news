import { chat, extractJSON } from './bots/lib/llm.mjs';

async function test() {
  const headlines = `0|BBC|US tech giants report strong quarterly revenue
1|Reuters|Wall Street rises on mega-cap tech earnings
2|DW|European leaders meet in Brussels for climate talks
3|France 24|EU summit focuses on renewable energy targets`;

  const prompt = [
    { role: 'system', content: 'You are the news desk. You group headlines into events in JSON.' },
    { role: 'user', content: `Headlines:\n${headlines}\n\nGroup into events. Return ONLY valid JSON:\n{"events":[{"ids":[0,1],"category":"business","importance":4,"event":"Tech earnings boost markets"}]}` }
  ];

  console.log('Sending request to desk model...');
  const res = await chat('desk', prompt, { maxTokens: 1000 });
  console.log('Raw text:', JSON.stringify(res.text));
  const parsed = extractJSON(res.text);
  console.log('Parsed successfully:', parsed);
}

test().catch(console.error);
