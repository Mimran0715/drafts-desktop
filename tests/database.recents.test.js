const { describe, expect, it } = require('vitest');
const { readFileSync } = require('node:fs');

const source = readFileSync('electron/database.js', 'utf8');

describe('recent project retention', () => {
  it('upserts by project path to avoid duplicates', () => {
    expect(source).toMatch(/ON CONFLICT\s*\(path\)\s*DO UPDATE/i);
  });

  it('refreshes last_opened when a project is reopened', () => {
    expect(source).toMatch(/ON CONFLICT\s*\(path\)[\s\S]*last_opened\s*=\s*CURRENT_TIMESTAMP/i);
  });

  it('prunes stored projects to ten after insertion', () => {
    const addFunction = source.slice(source.indexOf('function addRecentProject'), source.indexOf('function getRecentProjects'));
    expect(addFunction).toMatch(/DELETE FROM projects/i);
    expect(addFunction).toMatch(/(?:LIMIT\s+-1\s+OFFSET\s+10|NOT IN[\s\S]*LIMIT\s+10)/i);
  });
});
