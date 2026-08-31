import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDetailLines, buildCompiledText } from '../js/prayer/compile.js';

test('getDetailLines: details 배열 우선, 공백 제거·빈 값 제외', () => {
  assert.deepEqual(getDetailLines({ details: [' a ', '', 'b'] }), ['a', 'b']);
});

test('getDetailLines: detail 문자열은 줄 단위로 나눈다', () => {
  assert.deepEqual(getDetailLines({ detail: '첫째\n\n둘째 \n' }), ['첫째', '둘째']);
});

test('getDetailLines: 둘 다 없으면 빈 배열', () => {
  assert.deepEqual(getDetailLines({}), []);
  assert.deepEqual(getDetailLines(null), []);
});

test('buildCompiledText: 카카오톡 붙여넣기 형식', () => {
  const meeting = { id: 3, meeting_date: '2026-08-23', meeting_number: 40 };
  const cards = [
    { nickname: '지영', items: [{ title: '건강', detail: '허리\n잠' }, { title: '가족', detail: '' }] },
    { nickname: '선재', items: [{ title: '취업' }] },
  ];
  const expected =
    '♥ 우리 순 기도제목 ♥\n' +
    '2026.08.23 40번째 순모임\n' +
    '\n♥지영\n' +
    '1. 건강\n' +
    '- 허리\n' +
    '- 잠\n' +
    '2. 가족\n' +
    '\n♥선재\n' +
    '1. 취업\n';
  assert.equal(buildCompiledText(meeting, cards), expected);
});
