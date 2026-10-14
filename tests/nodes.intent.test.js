const { describe, expect, it } = require('vitest');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function classifier() {
  const source = readFileSync('electron/ai/nodes.js', 'utf8');
  const start = source.indexOf('function classifyIntentFromText');
  const end = source.indexOf('\nfunction isAmbiguousConversationalIntent', start);
  const sandbox = {};
  vm.runInNewContext(`${source.slice(start, end)}; result = classifyIntentFromText`, sandbox);
  return sandbox.result;
}

describe('summary intent heuristics', () => {
  it.each(['summarize this chapter', 'Give me a SUMMARY OF the draft', 'TL;DR please'])(
    'classifies %s as analyze without an Ollama dependency',
    input => expect(classifier()(input)).toMatch(/^analyze:/)
  );

  it('preserves existing generate and question heuristics', () => {
    expect(classifier()('continue the scene')).toMatch(/^generate:/);
    expect(classifier()('why did this happen?')).toMatch(/^question:/);
  });
});
