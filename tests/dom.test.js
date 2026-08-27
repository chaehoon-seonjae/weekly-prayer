import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/ui/dom.js';

test('escapeHtml: HTML 특수문자 5종을 엔티티로 치환한다', () => {
  assert.equal(escapeHtml(`<b>&"'</b>`), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
});

test('escapeHtml: null/undefined는 빈 문자열', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml: 문자열이 아닌 값은 문자열로 변환한다', () => {
  assert.equal(escapeHtml(42), '42');
});
