import { setApp } from './ui/dom.js';
import { renderBottomNav, bindBottomNav } from './ui/nav.js';

function initialState() {
  return {
    view: 'qt',                 // 'qt' | 'prayer' | 'my'
    qtTab: 'my',                // 'my' | 'feed'
    auth: { user: null, profile: null },
    qt: { records: [], month: new Date() },
    feed: { items: [] },
    prayer: { meetings: [], prayers: [], profiles: [], currentMeetingId: null, collapsed: {} },
  };
}

export const appState = initialState();

export function resetState() {
  Object.assign(appState, initialState());
}

// 화면 모듈이 자기 렌더 함수를 등록한다. state.js는 화면 모듈을 import하지 않는다(순환 방지).
const pages = new Map();

export function registerPage(view, renderFn) {
  pages.set(view, renderFn);
}

export function render() {
  const page = pages.get(appState.view);
  if (!page) throw new Error(`등록되지 않은 화면: ${appState.view}`);
  page();
}

export function navigate(view) {
  appState.view = view;
  render();
}

// 본문 + 하단 탭을 함께 그리고 탭 이벤트를 바인딩한다. 각 화면은 이 함수 뒤에 자기 이벤트를 바인딩한다.
export function renderShell(contentHtml) {
  setApp(`${contentHtml}${renderBottomNav(appState.view)}`);
  bindBottomNav(navigate);
}
