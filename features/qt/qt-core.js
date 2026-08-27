(function () {
  window.QT = window.QT || {};

  const Core = {
    formatDateKey(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    getDateFromKey(dateKey) {
      const [y, m, d] = String(dateKey).split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    },

    getQtDaysForMonth(date) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const first = new Date(year, month, 1);
      const start = new Date(first);
      start.setDate(start.getDate() - ((first.getDay() + 6) % 7));

      const rows = [];
      const cursor = new Date(start);
      for (let i = 0; i < 42; i += 1) {
        rows.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return rows;
    },

    getCurrentStreak(records) {
      const unique = [...new Set(records.map(r => r.date))].sort();
      const set = new Set(unique);
      const cursor = new Date();
      let streak = 0;

      while (set.has(this.formatDateKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    },

    getLongestStreak(records) {
      const unique = [...new Set(records.map(r => r.date))].sort();
      if (!unique.length) return 0;

      let longest = 1;
      let run = 1;

      for (let i = 1; i < unique.length; i += 1) {
        const prev = this.getDateFromKey(unique[i - 1]);
        const curr = this.getDateFromKey(unique[i]);
        const diff = Math.round((curr - prev) / 86400000);

        if (diff === 1) {
          run += 1;
          longest = Math.max(longest, run);
        } else {
          run = 1;
        }
      }

      return longest;
    },

    getQtProgress(total) {
      const thresholds = [
        { max: 6, stage: '씨앗', next: 7 },
        { max: 19, stage: '새싹', next: 20 },
        { max: 49, stage: '어린 식물', next: 50 },
        { max: 99, stage: '작은 나무', next: 100 },
        { max: 199, stage: '나무', next: 200 },
        { max: Infinity, stage: '풍성한 나무', next: null }
      ];

      for (let i = 0; i < thresholds.length; i += 1) {
        const item = thresholds[i];
        if (total <= item.max) {
          const previous = i === 0 ? 0 : thresholds[i - 1].max + 1;
          const currentRangeMin = previous;
          const currentRangeMax = item.max;
          const remaining = item.next ? Math.max(0, item.next - total) : 0;

          return {
            currentStage: item.stage,
            stageIndex: i,
            currentRangeMin,
            currentRangeMax,
            currentRangeLabel: `${currentRangeMin} ~ ${currentRangeMax}회`,
            remaining,
            progress: item.next
              ? Math.min(100, Math.max(0, ((total - currentRangeMin) / (item.next - currentRangeMin)) * 100))
              : 100,
            nextStage: item.next ? `다음 단계까지 ${remaining}번` : '최고 단계예요'
          };
        }
      }

      return {
        currentStage: '풍성한 나무',
        stageIndex: 5,
        currentRangeMin: 200,
        currentRangeMax: Infinity,
        currentRangeLabel: '200회 이상',
        remaining: 0,
        progress: 100,
        nextStage: '최고 단계예요'
      };
    },

    getQtPlantStage(total) {
      if (total >= 200) return { name: '풍성한 나무', icon: '🌳✨', range: '200회 이상' };
      if (total >= 100) return { name: '나무', icon: '🌳', range: '100 ~ 199회' };
      if (total >= 50) return { name: '작은 나무', icon: '🌲', range: '50 ~ 99회' };
      if (total >= 20) return { name: '어린 식물', icon: '🪴', range: '20 ~ 49회' };
      if (total >= 7) return { name: '새싹', icon: '🌱', range: '7 ~ 19회' };
      return { name: '씨앗', icon: '🫘', range: '0 ~ 6회' };
    },

    getQtSummary(records) {
      const unique = [...new Set(records.map(r => r.date))];
      return {
        total: unique.length,
        currentStreak: this.getCurrentStreak(records),
        longestStreak: this.getLongestStreak(records),
        doneToday: unique.includes(this.formatDateKey(new Date()))
      };
    }
  };

  window.QT.Core = Core;
})();
