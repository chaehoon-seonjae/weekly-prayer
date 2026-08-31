(function () {
  window.Prayer = window.Prayer || {};

  const MEMBERS = ['지영', '선재', '세희', '평화', '종호', '도희', '예송', '수람', '유찬'];

  const Core = {
    MEMBERS,
    sortedWeeksAsc() {
      return [...window.appState.weeks].sort((a, b) => a.week_date.localeCompare(b.week_date));
    },

    mostRecentSundayISO(base = new Date()) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      d.setDate(d.getDate() - d.getDay());
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    isPastWeek() {
      const meta = window.currentWeekMeta();
      return meta && meta.week_date < this.mostRecentSundayISO();
    },

    isFutureWeek() {
      const meta = window.currentWeekMeta();
      return meta && meta.week_date > this.mostRecentSundayISO();
    },

    isLatestMeeting() {
      const meta = window.currentWeekMeta();
      if (!meta) return false;
      const arr = this.sortedWeeksAsc();
      return meta.id === arr[arr.length - 1]?.id;
    },

    fmtDate(d) {
      const [y, m, day] = d.split('-');
      return `${y}.${m}.${day}`;
    },

    shortDate(d) {
      const [, m, day] = d.split('-');
      return `${m}/${day}`;
    },

    adjacentMeeting(direction) {
      const arr = this.sortedWeeksAsc();
      const idx = arr.findIndex(w => w.id === window.appState.currentWeek);
      return arr[idx + direction] || null;
    },

    defaultMeetingId() {
      const sunday = this.mostRecentSundayISO();
      const candidates = [...window.appState.weeks]
        .filter(w => w.week_date <= sunday)
        .sort((a, b) => b.week_date.localeCompare(a.week_date));
      return (candidates[0] || [...window.appState.weeks].sort((a, b) => b.week_date.localeCompare(a.week_date))[0])?.id;
    },

    isCurrentMeeting() {
      return window.appState.currentWeek === this.defaultMeetingId();
    }
  };

  window.Prayer.Core = Core;
})();
