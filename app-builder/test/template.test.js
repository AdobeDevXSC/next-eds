import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate } from '../actions/convert-email/render/template.js';

test('escaped substitution', () => {
  assert.equal(renderTemplate('Hello {{name}}', { name: 'World' }), 'Hello World');
});

test('escaped substitution entity-encodes its value', () => {
  assert.equal(renderTemplate('{{name}}', { name: '<b>x</b> & y' }), '&lt;b&gt;x&lt;/b&gt; &amp; y');
});

test('raw substitution does not escape', () => {
  assert.equal(renderTemplate('{{{html}}}', { html: '<b>x</b>' }), '<b>x</b>');
});

test('dot-path resolves nested arrays/objects', () => {
  assert.equal(renderTemplate('{{{rows.0.0}}}', { rows: [['A', 'B'], ['C']] }), 'A');
  assert.equal(renderTemplate('{{{rows.1.0}}}', { rows: [['A', 'B'], ['C']] }), 'C');
});

test('missing path resolves to empty string, never throws', () => {
  assert.equal(renderTemplate('[{{{missing.deep.path}}}]', {}), '[]');
  assert.equal(renderTemplate('[{{missing}}]', { rows: [] }), '[]');
});

test('tolerates optional whitespace inside delimiters', () => {
  assert.equal(renderTemplate('{{ name }}', { name: 'x' }), 'x');
  assert.equal(renderTemplate('{{{ html }}}', { html: 'x' }), 'x');
});

test('#each iterates an array, {{{this}}} is the current item', () => {
  const out = renderTemplate('{{#each items}}<li>{{{this}}}</li>{{/each}}', { items: ['a', 'b'] });
  assert.equal(out, '<li>a</li><li>b</li>');
});

test('#each over an empty or missing array renders nothing, no throw', () => {
  assert.equal(renderTemplate('[{{#each items}}<li>{{{this}}}</li>{{/each}}]', { items: [] }), '[]');
  assert.equal(renderTemplate('[{{#each missing}}<li>{{{this}}}</li>{{/each}}]', {}), '[]');
});

test('#each supports dot-paths into each item when the item is an object', () => {
  const out = renderTemplate('{{#each items}}{{{label}}}:{{{href}}};{{/each}}', {
    items: [{ label: 'Go', href: '/a' }, { label: 'Shop', href: '/b' }],
  });
  assert.equal(out, 'Go:/a;Shop:/b;');
});

test('#eachChunk groups an array into fixed-size chunks; {{{this}}} inside is the current chunk (an array)', () => {
  const tmpl = '{{#eachChunk items 2}}<section>{{#each this}}<col>{{{this}}}</col>{{/each}}</section>{{/eachChunk}}';
  const out = renderTemplate(tmpl, { items: ['a', 'b', 'c'] });
  assert.equal(out, '<section><col>a</col><col>b</col></section><section><col>c</col></section>');
});

test('#eachChunk over an empty array renders nothing', () => {
  const tmpl = '[{{#eachChunk items 2}}<section>{{#each this}}{{{this}}}{{/each}}</section>{{/eachChunk}}]';
  assert.equal(renderTemplate(tmpl, { items: [] }), '[]');
});

test('static text with no tags passes through unchanged', () => {
  assert.equal(renderTemplate('<mj-section></mj-section>', {}), '<mj-section></mj-section>');
});

test('reproduces the four real block templates against realistic data', () => {
  const heroTmpl = '<mj-section padding="0"><mj-column>{{{rows.0.0}}}</mj-column></mj-section>';
  assert.equal(
    renderTemplate(heroTmpl, { rows: [['<mj-text>Hi</mj-text>']] }),
    '<mj-section padding="0"><mj-column><mj-text>Hi</mj-text></mj-column></mj-section>',
  );

  const columnsTmpl = '<mj-section>{{#each rows.0}}<mj-column>{{{this}}}</mj-column>{{/each}}</mj-section>';
  assert.equal(
    renderTemplate(columnsTmpl, { rows: [['<mj-text>L</mj-text>', '<mj-text>R</mj-text>']] }),
    '<mj-section><mj-column><mj-text>L</mj-text></mj-column><mj-column><mj-text>R</mj-text></mj-column></mj-section>',
  );

  const cardsTmpl = '{{#eachChunk rowFragments 2}}<mj-section>{{#each this}}<mj-column>{{{this}}}</mj-column>{{/each}}</mj-section>{{/eachChunk}}';
  assert.equal(
    renderTemplate(cardsTmpl, { rowFragments: ['<mj-text>1</mj-text>', '<mj-text>2</mj-text>', '<mj-text>3</mj-text>'] }),
    '<mj-section><mj-column><mj-text>1</mj-text></mj-column><mj-column><mj-text>2</mj-text></mj-column></mj-section>'
    + '<mj-section><mj-column><mj-text>3</mj-text></mj-column></mj-section>',
  );
});
