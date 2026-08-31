export function openSheet(html) {
  const overlay = document.getElementById('overlay');
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'activeSheet';
  sheet.innerHTML = '<div class="sheet-handle"></div>' + html;
  document.body.appendChild(sheet);
  overlay.classList.add('show');
  requestAnimationFrame(() => sheet.classList.add('show'));
  overlay.onclick = closeSheet;
  return sheet;
}

export function closeSheet() {
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('activeSheet');
  overlay.classList.remove('show');
  if (sheet) {
    sheet.classList.remove('show');
    setTimeout(() => sheet.remove(), 250);
  }
}
