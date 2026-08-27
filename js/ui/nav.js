const ITEMS = [
  { key: 'qt', label: 'QT', icon: '🌱' },
  { key: 'prayer', label: '기도제목', icon: '🙏' },
  { key: 'my', label: 'MY', icon: '👤' },
];

export function renderBottomNav(activeView) {
  return `
    <nav class="app-nav">
      ${ITEMS.map(item => `
        <button type="button" class="${activeView === item.key ? 'active' : ''}" data-nav="${item.key}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

export function bindBottomNav(onSelect) {
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.onclick = () => onSelect(button.dataset.nav);
  });
}
