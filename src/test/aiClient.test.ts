import { describe, it, expect } from 'vitest';
import { buildAiRequest, modelForProvider, resolveAiProvider } from '../../supabase/functions/_shared/aiClient.ts';

const body = JSON.stringify({
  model: 'google/gemini-2.5-pro',
  stream: true,
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }] }],
  tools: [{ type: 'function', function: { name: 'x', parameters: {} } }],
});
const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };

describe('aiClient', () => {
  it('keeps the Lovable gateway when only LOVABLE_API_KEY is set (today)', () => {
    const r = buildAiRequest({ LOVABLE_API_KEY: 'lk' }, init);
    expect(r.provider).toBe('lovable');
    expect(r.url).toBe('https://ai.gateway.lovable.dev/v1/chat/completions');
    expect(new Headers(r.init.headers).get('Authorization')).toBe('Bearer lk');
    expect(r.init.body).toBe(body);
    expect(r.model).toBe('google/gemini-2.5-pro');
  });

  it('switches to Google when GEMINI_API_KEY is set, stripping the gateway prefix only', () => {
    const r = buildAiRequest({ GEMINI_API_KEY: 'gk', LOVABLE_API_KEY: 'lk' }, init);
    expect(r.provider).toBe('gemini');
    expect(r.url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(new Headers(r.init.headers).get('Authorization')).toBe('Bearer gk');
    const sent = JSON.parse(r.init.body as string);
    const original = JSON.parse(body);
    expect(sent.model).toBe('gemini-2.5-pro');
    expect({ ...sent, model: original.model }).toEqual(original);
  });

  it('fails loudly when no provider is configured', () => {
    expect(resolveAiProvider({})).toBeNull();
    expect(() => buildAiRequest({}, init)).toThrow(/not configured/);
  });

  it('maps model names per provider', () => {
    expect(modelForProvider('google/gemini-3-flash-preview', 'gemini')).toBe('gemini-3-flash-preview');
    expect(modelForProvider('google/gemini-3-flash-preview', 'lovable')).toBe('google/gemini-3-flash-preview');
  });
});
