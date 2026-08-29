import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readWebSource = (file) => readFile(new URL(`../../web/src/${file}`, import.meta.url), 'utf8');

test('Kali workspace keeps one noVNC session and activates the selected GUI tool', async () => {
  const source = await readWebSource('KaliWorkspacePanel.tsx');

  assert.match(source, /const \[guiInitialized, setGuiInitialized\] = useState\(false\)/);
  assert.match(source, /\{guiInitialized && \(/);
  assert.match(source, /guiVisible \? 'panel kali-gui-panel' : 'panel kali-gui-panel kali-view-hidden'/);
  assert.match(source, /terminalbox-activate-tool burp/);
  assert.match(source, /terminalbox-activate-tool wireshark/);
  assert.match(source, /terminalbox-activate-tool desktop/);
});

test('online AI and security tool wording are the defaults', async () => {
  const source = await readWebSource('App.tsx');

  assert.match(source, /useState<AssistantTab>\('assistant-online'\)/);
  assert.match(source, /setAssistantTab\('assistant-online'\)/);
  assert.match(source, />\s*セキュリティツール\s*</);
});

test('every learning category starts with its hint collapsed', async () => {
  const sources = await Promise.all([
    readWebSource('BasicOperationsPanel.tsx'),
    readWebSource('TutorialPanel.tsx'),
    readWebSource('ChallengePanel.tsx'),
  ]);

  for (const source of sources) {
    assert.match(source, /const \[hintVisible, setHintVisible\] = useState\(false\)/);
    assert.match(source, /aria-expanded=\{hintVisible\}/);
    assert.match(source, /hintVisible && <div className="lesson-card lesson-hint">/);
  }
});

test('tool clear control is rendered to the left of its completion badge', async () => {
  const source = await readWebSource('ChallengePanel.tsx');
  assert.match(
    source,
    /lesson-title-status[\s\S]*?lesson-clear-button[\s\S]*?lesson-clear-badge/,
  );
  assert.doesNotMatch(source, /lesson-actions-single/);
});
