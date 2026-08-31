import html2canvas from 'html2canvas';

export interface ScreenCapture {
  mimeType: 'image/jpeg';
  data: string;
}

export async function captureTerminalBoxScreen(): Promise<ScreenCapture> {
  const terminalBox = document.querySelector<HTMLElement>('.app-shell');
  if (!terminalBox) throw new Error('TerminalBox画面を取得できませんでした。');

  const sourceWidth = Math.max(terminalBox.scrollWidth, terminalBox.clientWidth, window.innerWidth);
  const sourceHeight = Math.max(terminalBox.scrollHeight, terminalBox.clientHeight, window.innerHeight);
  const scale = Math.min(1, 1600 / sourceWidth, 12000 / sourceHeight);
  const canvas = await html2canvas(terminalBox, {
    backgroundColor: '#070b09',
    height: sourceHeight,
    width: sourceWidth,
    scale,
    useCORS: true,
    windowHeight: sourceHeight,
    windowWidth: sourceWidth,
  });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
  return { mimeType: 'image/jpeg', data: dataUrl.split(',', 2)[1] ?? '' };
}
