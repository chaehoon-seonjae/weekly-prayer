// 식물 성장 단계. 순수 함수. 아이콘·이미지는 features/qt(협업자 작업)와 동일.
export const PLANT_STAGES = [
  { name: '씨앗', icon: '🫘', image: './assets/plants/seed.png', min: 0, max: 6 },
  { name: '새싹', icon: '🌱', image: './assets/plants/sprout.png', min: 7, max: 19 },
  { name: '어린 식물', icon: '🪴', image: './assets/plants/young-plant.png', min: 20, max: 49 },
  { name: '작은 나무', icon: '🌲', image: './assets/plants/small-tree.png', min: 50, max: 99 },
  { name: '나무', icon: '🌳', image: './assets/plants/tree.png', min: 100, max: 199 },
  { name: '풍성한 나무', icon: '🌳✨', image: './assets/plants/full-tree.png', min: 200, max: Infinity },
];

export function getStage(total) {
  return PLANT_STAGES.find(stage => total <= stage.max);
}

export function getProgress(total) {
  const index = PLANT_STAGES.findIndex(stage => total <= stage.max);
  const stage = PLANT_STAGES[index];
  const next = PLANT_STAGES[index + 1] || null;
  if (!next) return { stage, next: null, remaining: 0, percent: 100 };
  const remaining = Math.max(0, next.min - total);
  const percent = Math.min(100, Math.max(0, ((total - stage.min) / (next.min - stage.min)) * 100));
  return { stage, next, remaining, percent };
}
