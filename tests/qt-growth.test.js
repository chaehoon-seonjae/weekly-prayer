import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANT_STAGES, getStage, getProgress } from '../js/qt/growth.js';

test('경계값마다 단계와 이미지가 맞는다 (README 표)', () => {
  const cases = [
    [0, '씨앗'], [6, '씨앗'], [7, '새싹'], [19, '새싹'], [20, '어린 식물'],
    [49, '어린 식물'], [50, '작은 나무'], [99, '작은 나무'], [100, '나무'],
    [199, '나무'], [200, '풍성한 나무'], [500, '풍성한 나무'],
  ];
  for (const [total, name] of cases) {
    assert.equal(getStage(total).name, name, `total=${total}`);
  }
  assert.equal(PLANT_STAGES.length, 6);
  assert.equal(getStage(0).image, './assets/plants/seed.png');
  assert.equal(getStage(200).image, './assets/plants/full-tree.png');
});

test('getProgress: 다음 단계까지 남은 횟수와 퍼센트', () => {
  const p = getProgress(10); // 새싹(7~19), 다음 20
  assert.equal(p.stage.name, '새싹');
  assert.equal(p.next.name, '어린 식물');
  assert.equal(p.remaining, 10);
  assert.ok(Math.abs(p.percent - ((10 - 7) / (20 - 7)) * 100) < 1e-9);
});

test('getProgress: 최고 단계는 next 없음·100%', () => {
  const p = getProgress(250);
  assert.equal(p.next, null);
  assert.equal(p.remaining, 0);
  assert.equal(p.percent, 100);
});
