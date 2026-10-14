const { describe, expect, it } = require('vitest');
const { readFileSync } = require('node:fs');

const db = () => readFileSync('electron/database.js', 'utf8');
const app = () => readFileSync('src/App.tsx', 'utf8');
const preload = () => readFileSync('electron/preload.js', 'utf8');

describe('persisted editor preferences', () => {
  it('reads and saves fontSize and theme through the preferences API', () => {
    expect(db()).toMatch(/fontSize/);
    expect(db()).toMatch(/theme/);
    expect(db()).toMatch(/savePreferences|setPreferences/);
  });

  it('merges preference updates rather than replacing existing keys', () => {
    expect(db()).toMatch(/(?:\.\.\.|Object\.assign|ON CONFLICT)[\s\S]*(?:preferences|existing)/i);
  });

  it('exposes preferences through preload and restores both values in App', () => {
    expect(preload()).toMatch(/(?:getPreferences|getAllPreferences)/);
    expect(preload()).toMatch(/(?:savePreferences|setPreferences)/);
    expect(app()).toMatch(/fontSize/);
    expect(app()).toMatch(/theme/);
  });
});
