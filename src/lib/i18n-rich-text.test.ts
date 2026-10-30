import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../messages/bg.json';
import en from '../../messages/en.json';

const LOCALES = { bg, en };

function flatten(messages: object, prefix = ''): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : flatten(value, `${prefix}${key}.`)
  );
}

describe.each(Object.entries(LOCALES))('rich-text messages (%s)', (locale, messages) => {
  // t.rich reads tags and arguments from one object, so <name>{name}</name> can't be rendered.
  it('never names a tag after an argument it wraps', () => {
    const clashes = flatten(messages).filter(([, text]) => /<(\w+)>[^<]*\{\1[,}]/.test(text));

    expect(clashes).toEqual([]);
  });

  it.each(['MergeDialog.description', 'ContactDetailClient.archiveDescription'])('renders %s with the name', (key) => {
    const errors: unknown[] = [];
    const t = createTranslator({ locale, messages, onError: (error) => errors.push(error) });

    const rendered = t.rich(key as never, { name: 'Ivan', strong: (chunks: unknown) => `[${chunks}]` } as never);

    expect(errors).toEqual([]);
    expect(String(Array.isArray(rendered) ? rendered.join('') : rendered)).toContain('[Ivan]');
  });
});
