// Apply the same unobtrusive scrollbars to the app and same-origin Target pages.
export function installScrollbarTheme(document: Document) {
  if (document.getElementById('terminalbox-scrollbar-theme')) return;
  const style = document.createElement('style');
  style.id = 'terminalbox-scrollbar-theme';
  style.textContent = `
    * { scrollbar-width: thin; scrollbar-color: rgba(127, 160, 144, .42) transparent; }
    *:hover { scrollbar-color: rgba(151, 192, 171, .65) transparent; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { background: transparent; }
    ::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 999px; background: rgba(127, 160, 144, .42); background-clip: padding-box; }
    ::-webkit-scrollbar-thumb:hover { background-color: rgba(151, 192, 171, .65); }
    ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
  `;
  document.head.appendChild(style);
}
