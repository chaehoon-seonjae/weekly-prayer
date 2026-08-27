(function () {
  window.QT = window.QT || {};

  function bootstrapQt() {
    window.QT.Core = window.QT.Core || {};
    window.QT.Data = window.QT.Data || {};
    window.QT.Render = window.QT.Render || {};

    if (typeof window.QT.Render.renderQtPage === 'function') {
      window.renderQtPage = window.QT.Render.renderQtPage;
    }
    if (typeof window.QT.Render.renderFeedPage === 'function') {
      window.renderFeedPage = window.QT.Render.renderFeedPage;
    }
    if (typeof window.QT.Render.openQtGrowthSheet === 'function') {
      window.openQtGrowthSheet = window.QT.Render.openQtGrowthSheet;
    }
    if (typeof window.QT.Data.getQtRecords === 'function') {
      window.getQtRecords = window.QT.Data.getQtRecords;
    }
    if (typeof window.QT.Data.getQtReflections === 'function') {
      window.getQtReflections = window.QT.Data.getQtReflections;
    }
    if (typeof window.QT.Core.getQtSummary === 'function') {
      window.getQtSummary = (records) => window.QT.Core.getQtSummary(records || window.QT.Data.getQtRecordsLocal());
    }
  }

  bootstrapQt();
})();