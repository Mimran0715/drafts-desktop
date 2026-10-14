import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/components/DraftEditor.tsx'), 'utf8');

describe('DraftEditor word count', () => {
  it('renders the count in the required test element with singular handling', () => {
    expect(source).toMatch(/data-testid=["']word-count["']/);
    expect(source).toMatch(/wordCount\s*===\s*1[\s\S]{0,100}word[\s\S]{0,100}words/);
  });

  it('counts non-empty whitespace-delimited words', () => {
    expect(source).toMatch(/\.trim\(\)\.split\(\/\\s\+\/[a-z]*\)\.filter/);
  });

  it('updates the displayed count when editor content changes', () => {
    expect(source).toMatch(/useEffect\([\s\S]*?setWordCount\([\s\S]*?\[activeTab\?\.content\]/);
  });
});
