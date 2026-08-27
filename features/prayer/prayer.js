(function () {
  window.Prayer = window.Prayer || {};

  function bootstrapPrayer() {
    window.Prayer.Core = window.Prayer.Core || {};
    window.Prayer.Render = window.Prayer.Render || {};

    if (typeof window.Prayer.Render.renderPrayerView === 'function') {
      window.renderPrayerView = window.Prayer.Render.renderPrayerView;
    }
    if (typeof window.Prayer.Render.bindHomeEvents === 'function') {
      window.bindHomeEvents = window.Prayer.Render.bindHomeEvents;
    }
    if (typeof window.Prayer.Render.openSheet === 'function') {
      window.openSheet = window.Prayer.Render.openSheet;
    }
    if (typeof window.Prayer.Render.closeSheet === 'function') {
      window.closeSheet = window.Prayer.Render.closeSheet;
    }
    if (typeof window.Prayer.Render.openMemberSheet === 'function') {
      window.openMemberSheet = window.Prayer.Render.openMemberSheet;
    }
    if (typeof window.Prayer.Render.renderWriteSheet === 'function') {
      window.openWriteSheet = function (name, isEdit) {
        window.Prayer.Render.renderWriteSheet(name, isEdit);
      };
    }
  }

  bootstrapPrayer();
})();
