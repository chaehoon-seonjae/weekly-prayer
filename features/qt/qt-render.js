(function () {
  window.QT = window.QT || {};

  const Core = window.QT.Core;
  const Data = window.QT.Data;

  function ensureCalendarState() {
    if (!window.appState.qtCalendarState) {
      window.appState.qtCalendarState = { revealed: null, open: null };
    }
    return window.appState.qtCalendarState;
  }

  function getActiveQtDateKey() {
    const calState = ensureCalendarState();
    return calState.open || calState.revealed || Core.formatDateKey(new Date());
  }

  function renderDetailPanel(
    todayKey,
    isDoneToday,
    records = Data.getQtRecordsLocal(),
    reflections = Data.getQtReflectionsLocal()
  ) {
    const calState = ensureCalendarState();
    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    const selectedKey = calState.open || calState.revealed;

    if (!selectedKey) {
      panel.innerHTML = '';
      return;
    }

    const selectedDone = records.some(item => item.date === selectedKey);
    const dateLabel = Core.getDateFromKey(selectedKey);
    const isSelectedToday = selectedKey === todayKey;

    /*
     * 날짜를 선택해서 상세 상태가 열린 경우
     */
    if (calState.open) {
      /*
       * QT 기록이 없는 날짜
       */
      if (!selectedDone) {
        // 과거 날짜
        if (!isSelectedToday) {
          panel.innerHTML = `
            <div class="dp-note">
              남겨진 QT 기록이 없어요.
            </div>
          `;
          return;
        }

        // 오늘
        panel.innerHTML = `
          <div class="dp-note">
            오늘도 말씀과 함께해볼까요?
          </div>

          <button
            class="qt-check-btn"
            type="button"
            data-qt-complete
            data-qt-date="${selectedKey}"
          >
            <span class="check-icon"></span>
            <span>QT 완료하기</span>
          </button>
        `;
        return;
      }

      /*
       * QT 기록이 있는 날짜
       */
      const record = reflections.find(item => item.date === selectedKey);
      const content = record && record.content ? record.content : '';

      // 묵상이 이미 작성되어 있음
      if (content) {
        panel.innerHTML = `
          <div class="reflection-read">
            <div class="rp-date">
              ${dateLabel.getFullYear()}년
              ${dateLabel.getMonth() + 1}월
              ${dateLabel.getDate()}일 묵상
            </div>

            <div class="rp-content">
              ${window.escapeHtml(content)}
            </div>
          </div>
        `;
        return;
      }

      // 과거 날짜이며 QT만 완료하고 묵상은 없는 경우
      if (!isSelectedToday) {
        panel.innerHTML = `
          <div class="dp-note">
            이 날도 말씀과 함께했어요. 🌿
          </div>
        `;
        return;
      }

      // 오늘 QT를 완료했고 아직 묵상을 남기지 않은 경우
      panel.innerHTML = `
        <div class="dp-note">
          <strong>오늘도 말씀과 함께했어요. 🌿</strong>
          받은 마음을 짧게 남겨보세요.
        </div>

        <div class="reflection-write">
          <textarea
            id="qtReflectionInput"
            placeholder="오늘 말씀을 통해 받은 마음이 있나요?"
          >${window.escapeHtml(content)}</textarea>

          <button
            type="button"
            class="save-btn"
            data-qt-save-reflection
            data-qt-date="${selectedKey}"
          >
            묵상 나누기
          </button>
        </div>
      `;

      return;
    }

    /*
     * 달력 날짜를 한 번 눌러 revealed 상태만 된 경우
     */
    if (calState.revealed && !calState.open) {
      if (!selectedDone) {
        if (!isSelectedToday) {
          panel.innerHTML = `
            <div class="dp-note">
              이날은 아직 남겨진 QT 기록이 없어요.
            </div>
          `;
          return;
        }

        panel.innerHTML = `
          <div class="dp-note">
            오늘도 말씀과 함께해볼까요?
          </div>

          <button
            class="qt-check-btn"
            type="button"
            data-qt-complete
            data-qt-date="${selectedKey}"
          >
            <span class="check-icon"></span>
            <span>QT 완료하기</span>
          </button>
        `;
        return;
      }

      /*
       * 완료한 과거 날짜는 날짜 선택만 했을 때는
       * 별도 패널을 보여주지 않는다.
       */
      panel.innerHTML = '';
      return;
    }

    /*
     * 별도의 날짜를 선택하지 않은 기본 상태
     * → 오늘 기준
     */
    if (!isDoneToday) {
      panel.innerHTML = `
        <div class="dp-note">
          오늘도 말씀과 함께해볼까요?
        </div>

        <button
          class="qt-check-btn"
          type="button"
          data-qt-complete
          data-qt-date="${todayKey}"
        >
          <span class="check-icon"></span>
          <span>QT 완료하기</span>
        </button>
      `;

      return;
    }

    /*
     * 오늘 QT 완료 상태
     */
    const reflectionText =
      reflections.find(item => item.date === todayKey)?.content || '';

    panel.innerHTML = `
      <div class="dp-note">
        <strong>오늘도 말씀과 함께했어요. 🌿</strong>
        받은 마음을 짧게 남겨보세요.
      </div>

      <div class="reflection-write">
        <textarea
          id="qtReflectionInput"
          placeholder="오늘 말씀을 통해 받은 마음이 있나요?"
        >${window.escapeHtml(reflectionText)}</textarea>

        <button
          type="button"
          class="save-btn"
          data-qt-save-reflection
          data-qt-date="${todayKey}"
        >
          묵상 나누기
        </button>
      </div>
    `;
  }

  function bindQtEvents() {
    /*
     * QT Tab
     */
    document.querySelectorAll('[data-qt-tab]').forEach(button => {
      button.onclick = () => {
        window.appState.qtTab = button.dataset.qtTab;
        window.appState.currentView = 'qt';
        window.render();
      };
    });

    /*
     * 이전 / 다음 달
     */
    document.querySelectorAll('[data-month]').forEach(button => {
      button.onclick = () => {
        const next = new Date(window.appState.qtMonth);

        next.setMonth(
          next.getMonth() + (button.dataset.month === 'next' ? 1 : -1)
        );

        window.appState.qtMonth = next;

        window.appState.qtCalendarState = {
          revealed: null,
          open: null
        };

        window.render();
      };
    });

    /*
     * Calendar 날짜 클릭
     */
    document.querySelectorAll('[data-calendar-day]').forEach(cell => {
        cell.onclick = () => {
        const dateKey = cell.dataset.calendarDay;
        const todayKey = Core.formatDateKey(new Date());

        // 미래 날짜는 선택 불가
        if (dateKey > todayKey) return;

        const calState = ensureCalendarState();

        // 클릭한 날짜를 항상 선택 상태로 유지
        calState.revealed = dateKey;
        calState.open = dateKey;

        window.render();
      };
    });
    /*
     * 오늘 QT 완료
     */
    const completeButton =
      document.querySelector('[data-qt-complete]');

    if (completeButton) {
      completeButton.onclick = async () => {
        const targetDate =
          completeButton.dataset.qtDate ||
          getActiveQtDateKey();

        const todayKey =
          Core.formatDateKey(new Date());

        /*
         * 과거 / 미래 QT 기록 생성 방지
         */
        if (targetDate !== todayKey) {
          window.showToast(
            'QT 기록은 오늘의 걸음부터 남길 수 있어요.'
          );
          return;
        }

        const records =
          await Data.getQtRecords();

        if (
          records.some(
            record => record.date === targetDate
          )
        ) {
          window.showToast(
            '오늘의 QT 기록은 이미 남겨졌어요.'
          );
          return;
        }

        /*
         * QT 기록 저장
         */
        records.push({
          date: targetDate,
          created_at: new Date().toISOString()
        });

        await Data.saveQtRecords(records);

        /*
         * 묵상 작성용 빈 데이터 준비
         */
        const reflections =
          await Data.getQtReflections();

        const exists =
          reflections.some(
            item => item.date === targetDate
          );

        if (!exists) {
          reflections.push({
            id: crypto.randomUUID
              ? crypto.randomUUID()
              : String(Date.now()),
            date: targetDate,
            content: '',
            created_at: new Date().toISOString(),
            user: 'me'
          });

          await Data.saveQtReflections(
            reflections
          );
        }

        /*
         * 완료 후 오늘 상세 상태 열기
         */
        const calState =
          ensureCalendarState();

        calState.open = targetDate;
        calState.revealed = targetDate;

        window.showToast(
          '오늘도 말씀과 함께했어요 🌿'
        );

        window.render();
      };
    }

    /*
     * 묵상 저장
     */
    const reflectionSaveButton =
      document.querySelector(
        '[data-qt-save-reflection]'
      );

    if (reflectionSaveButton) {
      reflectionSaveButton.onclick =
        async () => {
          const input =
            document.getElementById(
              'qtReflectionInput'
            );

          if (!input) return;

          const value =
            input.value.trim();

          /*
           * 빈 묵상은 저장하지 않음
           */
          if (!value) {
            window.showToast(
              '묵상을 한 줄 남겨주세요.'
            );
            return;
          }

          const targetDate =
            reflectionSaveButton.dataset.qtDate ||
            getActiveQtDateKey();

          const todayKey =
            Core.formatDateKey(new Date());

          /*
           * 과거 날짜에 새 묵상 작성 금지
           */
          if (targetDate !== todayKey) {
            window.showToast(
              '묵상은 오늘의 기록에 남길 수 있어요.'
            );
            return;
          }

          const list =
            await Data.getQtReflections();

          const existingIndex =
            list.findIndex(
              item => item.date === targetDate
            );

          if (existingIndex >= 0) {
            list[existingIndex].content =
              value;
          } else {
            list.push({
              id: crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),
              date: targetDate,
              content: value,
              created_at:
                new Date().toISOString(),
              user: 'me'
            });
          }

          await Data.saveQtReflections(
            list
          );

          const calState =
            ensureCalendarState();

          calState.open = targetDate;
          calState.revealed =
            targetDate;

          window.showToast(
            '오늘의 묵상을 나눴어요 ☀️'
          );

          window.render();
        };
    }

    /*
     * 묵상 Reaction
     */
    const reactionButtons =
      document.querySelectorAll(
        '[data-reflection-reaction]'
      );

    reactionButtons.forEach(button => {
      button.onclick = async () => {
        const key =
          button.dataset.reflectionReaction;

        const reactions =
          await Data.getQtReactions();

        if (reactions[key]) {
          delete reactions[key];
        } else {
          reactions[key] = {
            created_at:
              new Date().toISOString()
          };
        }

        await Data.saveQtReactions(
          reactions
        );

        await renderFeedPage();
      };
    });

    /*
     * Plant Detail
     */
    const plantButton =
      document.querySelector(
        '[data-plant-detail]'
      );

    if (plantButton) {
      plantButton.onclick =
        async () =>
          openQtGrowthSheet();
    }
  }

  /*
   * 묵상 나눔
   */
  async function renderFeedPage() {
    const items = (
      await Data.getQtReflections()
    )
      .filter(
        item =>
          item.content &&
          item.content.trim()
      )
      .slice()
      .reverse();

    const reactions =
      await Data.getQtReactions();

    document.getElementById(
      'app'
    ).innerHTML = `
      <div class="qt-shell">

        <div class="qt-topbar">
          <div style="width:30px;"></div>
          <div class="qt-topbar-title">
            QT
          </div>
          <div style="width:30px;"></div>
        </div>

        <div class="qt-main-tabs">

          <button
            class="qt-tab ${
              window.appState.qtTab === 'my'
                ? 'active'
                : ''
            }"
            data-qt-tab="my"
          >
            나의 QT
          </button>

          <button
            class="qt-tab ${
              window.appState.qtTab === 'feed'
                ? 'active'
                : ''
            }"
            data-qt-tab="feed"
          >
            묵상 나눔
          </button>

        </div>

        <div class="feed-section-title">
          오늘의 묵상
          <span>☀️</span>
        </div>

        <div class="feed-list">

          ${
            items.length === 0
              ? `
                <div class="dp-note">
                  아직 나눠진 묵상이 없어요.
                  오늘 말씀을 통해 받은 마음을
                  첫 번째로 나눠보세요.
                </div>
              `
              : items
                  .map(item => {
                    const graceCount =
                      Object.keys(
                        reactions
                      ).filter(key =>
                        key.startsWith(
                          `${item.id}:grace`
                        )
                      ).length;

                    const prayCount =
                      Object.keys(
                        reactions
                      ).filter(key =>
                        key.startsWith(
                          `${item.id}:pray`
                        )
                      ).length;

                    const hasGrace =
                      Boolean(
                        reactions[
                          `${item.id}:grace`
                        ]
                      );

                    const hasPray =
                      Boolean(
                        reactions[
                          `${item.id}:pray`
                        ]
                      );

                    return `
                      <div class="feed-card">

                        <div class="feed-top">

                          <div class="feed-avatar">
                            ${
                              (
                                item.user ||
                                '나'
                              ).slice(
                                0,
                                1
                              )
                            }
                          </div>

                          <div class="feed-meta">

                            <div class="feed-name">
                              ${window.escapeHtml(
                                item.user ||
                                  '나'
                              )}
                            </div>

                            <div class="feed-date">
                              ${
                                item.date ||
                                '오늘'
                              }
                            </div>

                          </div>

                        </div>

                        <div class="feed-content">
                          ${window.escapeHtml(
                            item.content
                          )}
                        </div>

                        <div class="feed-actions">

                          <button
                            class="feed-action ${
                              hasGrace
                                ? 'active'
                                : ''
                            }"
                            type="button"
                            data-reflection-reaction="${item.id}:grace"
                          >
                            🙏 은혜받았어요
                            ${graceCount}
                          </button>

                          <button
                            class="feed-action ${
                              hasPray
                                ? 'active'
                                : ''
                            }"
                            type="button"
                            data-reflection-reaction="${item.id}:pray"
                          >
                            🤍 함께 기도해요
                            ${prayCount}
                          </button>

                        </div>

                      </div>
                    `;
                  })
                  .join('')
          }

        </div>

      </div>

      ${window.renderBottomNav()}
    `;

    window.bindGlobalNavigation();
    bindQtEvents();
  }

  /*
   * 식물 성장 상세 Bottom Sheet
   */
  async function openQtGrowthSheet() {
    const records = await Data.getQtRecords();
    const summary = Core.getQtSummary(records);

    const total = summary.total;
    const stage = Core.getQtPlantStage(total);
    const progress = Core.getQtProgress(total);

    // 다음 단계 이름
    const plantStages = [
    {
      name: '씨앗',
      image: './assets/plants/seed.png',
      min: 0
    },
    {
      name: '새싹',
      image: './assets/plants/sprout.png',
      min: 7
    },
    {
      name: '어린 식물',
      image: './assets/plants/young-plant.png',
      min: 20
    },
    {
      name: '작은 나무',
      image: './assets/plants/small-tree.png',
      min: 50
    },
    {
      name: '나무',
      image: './assets/plants/tree.png',
      min: 100
    },
    {
      name: '풍성한 나무',
      image: './assets/plants/full-tree.png',
      min: 200
    }
  ];

    const currentStageIndex = plantStages.findIndex(
      item => item.name === stage.name
    );

    const currentStage = plantStages[currentStageIndex];

    const nextStage =
      currentStageIndex >= 0 &&
      currentStageIndex < plantStages.length - 1
        ? plantStages[currentStageIndex + 1]
        : null;

    const progressPercent = nextStage
      ? Math.min(
          100,
          Math.max(
            0,
            ((total - plantStages[currentStageIndex].min) /
              (nextStage.min - plantStages[currentStageIndex].min)) *
              100
          )
        )
      : 100;

    const html = `
      <div class="growth-sheet">


        <!-- 식물 Hero -->
        <div class="growth-hero">

          <div class="growth-sun"></div>

          <div class="growth-sparkle sparkle-1">✦</div>
          <div class="growth-sparkle sparkle-2">✦</div>

          <div class="growth-plant">
            <img
              src="${currentStage.image}"
              alt="${currentStage.name}"
              class="growth-plant-image"
            >
          </div>

          <h2 class="growth-title">
            ${stage.name}
          </h2>

          <p class="growth-description">
            말씀과 함께 자라고 있어요
          </p>

        </div>

        ${
          nextStage
            ? `
              <!-- 성장 Progress -->
              <div class="growth-progress-section">

                <div class="growth-next-title">
                  ${stage.name}에서
                  <strong>${nextStage.name}</strong>으로 🌿
                </div>

                <div class="growth-progress-track">
                  <div
                    class="growth-progress-fill"
                    style="width:${progressPercent}%"
                  ></div>
                </div>

                <div class="growth-progress-meta">
                  <span>${total}번 함께했어요</span>
                  <strong>
                    다음 성장까지 ${progress.remaining || 0}번
                  </strong>
                </div>

              </div>
            `
            : `
              <div class="growth-complete">
                🌳 풍성하게 자라고 있어요
              </div>
            `
        }

        <!-- 기록 카드 -->
        <div class="growth-stats">

          <div class="growth-stat">
            <div class="growth-stat-icon">🔥</div>
            <strong>${summary.currentStreak}일</strong>
            <span>현재 연속</span>
          </div>

          <div class="growth-stat main">
            <div class="growth-stat-icon">☀️</div>
            <strong>${total}일</strong>
            <span>함께한 날</span>
          </div>

          <div class="growth-stat">
            <div class="growth-stat-icon">🏅</div>
            <strong>${summary.longestStreak}일</strong>
            <span>최장 연속</span>
          </div>

        </div>

        <div class="growth-message">
          오늘도 한 걸음 자라고 있어요 🌱
        </div>

      </div>
    `;

    if (window.openSheet) {
      window.openSheet(html);
    }
  }

  /*
   * 나의 QT 화면
   */
  async function renderQtPage() {
    const records =
      await Data.getQtRecords();

    const reflections =
      await Data.getQtReflections();

    const summary =
      Core.getQtSummary(records);

    const total =
      summary.total;

    const stage =
      Core.getQtPlantStage(total);

    const completionSet =
      new Set(
        records.map(item => item.date)
      );

    const monthDate =
      new Date(
        window.appState.qtMonth
      );

    const monthDays =
      Core.getQtDaysForMonth(
        monthDate
      );

    const todayKey =
      Core.formatDateKey(new Date());

    const calState =
      ensureCalendarState();

    const weekdays = [
      '일',
      '월',
      '화',
      '수',
      '목',
      '금',
      '토'
    ];

    const htmlDays =
      monthDays
        .map(date => {
          const key =
            Core.formatDateKey(date);

          const isCurrentMonth =
            date.getMonth() ===
            monthDate.getMonth();

          const isToday =
            key === todayKey;

          const isFuture =
            date >
            new Date(
              todayKey +
                'T00:00:00'
            );

          const isClickable =
            !isFuture;

          const done =
            completionSet.has(key);

          const isRevealedOrOpen =
            calState.revealed ===
              key ||
            calState.open === key;

          const classNames = [
            'calendar-day'
          ];

          if (!isCurrentMonth) {
            classNames.push(
              'muted'
            );
          }

          if (isToday) {
            classNames.push(
              'today'
            );
          }

          if (done && !isToday) {
            classNames.push(
              'completed'
            );
          }

          if (isClickable) {
            classNames.push(
              'clickable'
            );
          }

          let inner;

          /*
           * 완료한 과거 날짜는
           * 평상시에 🌿로 표시
           */
          if (
            done &&
            !isRevealedOrOpen &&
            !isToday
          ) {
            inner =
              '<span class="day-circle">🌿</span>';
          } else {
            inner = `
              <span class="day-circle">
                ${date.getDate()}
              </span>
            `;
          }

          const attrs = [];

          if (isClickable) {
            attrs.push(
              `data-calendar-day="${key}"`
            );
          }

          const disabled =
            isFuture
              ? 'pointer-events:none; opacity:0.7;'
              : '';

          return `
            <div
              class="${classNames.join(
                ' '
              )}"
              style="${disabled}"
              ${attrs.join(' ')}
            >
              ${inner}
            </div>
          `;
        })
        .join('');

    const isDoneToday =
      completionSet.has(todayKey);

    const selectedKey =
      calState.open ||
      calState.revealed;

    const selectedSummary = selectedKey
      ? (() => {
          const selectedDate = Core.getDateFromKey(selectedKey);
          const selectedDateText = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
          const selectedDone = completionSet.has(selectedKey);

          return `
            <div class="qt-selected-date-wrap">
              <div class="qt-selected-date">
                <span class="qt-selected-label">선택한 날짜</span>
                <strong>${selectedDateText}</strong>
                <span class="qt-selected-badge ${selectedDone ? 'done' : 'pending'}">
                  ${selectedDone ? 'QT 완료' : '미완료'}
                </span>
              </div>
            </div>
          `;
        })()
      : '';

    document.getElementById(
      'app'
    ).innerHTML = `

      <div class="qt-shell">

        <div class="qt-topbar">

          <div
            style="width:30px;"
          ></div>

          <div
            class="qt-topbar-title"
          >
            QT
          </div>

          <div
            style="width:30px;"
          ></div>

        </div>

        <div class="qt-main-tabs">

          <button
            class="qt-tab ${
              window.appState.qtTab ===
              'my'
                ? 'active'
                : ''
            }"
            data-qt-tab="my"
          >
            나의 QT
          </button>

          <button
            class="qt-tab ${
              window.appState.qtTab ===
              'feed'
                ? 'active'
                : ''
            }"
            data-qt-tab="feed"
          >
            묵상 나눔
          </button>

        </div>

        <button
          type="button"
          class="qt-banner"
          data-plant-detail
        >

          <span class="badge">
            ${stage.icon}
          </span>

          <span class="text">
            말씀과 함께한 날
            <strong>
              ${total}일
            </strong>
          </span>

          <span class="chevron">
            ›
          </span>

        </button>

        <div class="qt-calendar-card">

          <div class="calendar-header">

            <button
              type="button"
              data-month="prev"
            >
              ‹
            </button>

            <div>
              ${monthDate.getFullYear()}년
              ${monthDate.getMonth() + 1}월
            </div>

            <button
              type="button"
              data-month="next"
            >
              ›
            </button>

          </div>

          <div class="calendar-grid">

            ${weekdays
              .map(
                day => `
                  <div class="calendar-weekday">
                    ${day}
                  </div>
                `
              )
              .join('')}

            ${htmlDays}

          </div>

        </div>

        ${selectedSummary}

        <div
          class="detail-panel"
          id="detailPanel"
        ></div>

      </div>

      ${window.renderBottomNav()}
    `;

    window.bindGlobalNavigation();

    bindQtEvents();

    renderDetailPanel(
      todayKey,
      isDoneToday,
      records,
      reflections
    );

    bindQtEvents();
  }

  window.QT.Render = {
    ensureCalendarState,
    getActiveQtDateKey,
    renderDetailPanel,
    bindQtEvents,
    renderFeedPage,
    openQtGrowthSheet,
    renderQtPage
  };

  window.renderQtPage =
    renderQtPage;

  window.renderFeedPage =
    renderFeedPage;

  window.getQtRecords =
    Data.getQtRecords;

  window.getQtReflections =
    Data.getQtReflections;

  window.getQtSummary =
    records =>
      Core.getQtSummary(
        records ||
          Data.getQtRecordsLocal()
      );
})();