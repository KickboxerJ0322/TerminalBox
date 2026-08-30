import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readWebSource = (file) => readFile(new URL(`../../web/src/${file}`, import.meta.url), 'utf8');

test('Kali workspace keeps one noVNC session and activates the selected GUI tool', async () => {
  const [source, styles] = await Promise.all([
    readWebSource('KaliWorkspacePanel.tsx'),
    readWebSource('styles.css'),
  ]);

  assert.match(source, /const \[guiInitialized, setGuiInitialized\] = useState\(false\)/);
  assert.match(source, /\{guiInitialized && \(/);
  assert.match(source, /guiVisible \? 'panel kali-gui-panel' : 'panel kali-gui-panel kali-view-hidden'/);
  assert.match(source, /terminalbox-activate-tool burp/);
  assert.match(source, /terminalbox-activate-tool wireshark/);
  assert.match(source, /terminalbox-activate-tool desktop/);
  assert.match(styles, /\.kali-gui-panel\.kali-view-hidden\s*\{\s*display:\s*none/);
});

test('online AI and security tool wording are the defaults', async () => {
  const source = await readWebSource('App.tsx');

  assert.match(source, /useState<AssistantTab>\('assistant-online'\)/);
  assert.match(source, /setAssistantTab\('assistant-online'\)/);
  assert.match(source, />\s*セキュリティツール\s*</);
});

test('learning tabs put targets before security tools', async () => {
  const source = await readWebSource('App.tsx');
  assert.ok(source.indexOf('id="operations-tab"') < source.indexOf('id="tutorial-tab"'));
  assert.ok(source.indexOf('id="tutorial-tab"') < source.indexOf('id="targets-tab"'));
  assert.ok(source.indexOf('id="targets-tab"') < source.indexOf('id="tools-tab"'));
  assert.ok(source.indexOf('id="tools-tab"') < source.indexOf('id="web-attacks-tab"'));
});

test('Web Attacks synchronizes problem 5, history detection, and eight answer challenges', async () => {
  const [app, panel, target, styles] = await Promise.all([
    readWebSource('App.tsx'),
    readWebSource('ChallengePanel.tsx'),
    readWebSource('TargetPanel.tsx'),
    readWebSource('styles.css'),
  ]);

  assert.match(app, /scope="web-attacks"/);
  assert.match(app, /targetId === 5 \? 'web-attacks'/);
  assert.ok(app.indexOf("const webAttacksUrl = 'http://labtarget:3100/web-attacks'") < app.indexOf("historyWithoutWebAttacksUrl.lastIndexOf('labtarget')"));
  assert.match(app, /replaceAll\(webAttacksUrl, ' '\.repeat\(webAttacksUrl\.length\)\)/);
  assert.match(target, /http:\/\/labtarget:3100\/web-attacks\//);
  assert.match(target, /proxyPath: '\/tool-target\/web-attacks\/'/);
  assert.match(target, /\(\[1, 2, 3, 4, 5\] as const\)/);
  assert.match(styles, /\.target-site-tabs[^\n]+repeat\(5,/);

  for (const id of ['web-parameter', 'web-idor', 'web-sqli', 'web-xss', 'web-traversal', 'web-upload', 'web-ssrf', 'web-jwt']) {
    assert.match(panel, new RegExp(`answerId: '${id}'`));
  }
  assert.match(panel, /subtitle: 'Web Attacks 初級'/);

  const webGroup = panel.slice(panel.indexOf("id: 5,"), panel.indexOf('\n];', panel.indexOf("id: 5,")));
  assert.equal((webGroup.match(/hint: '/g) ?? []).length, 8);
  for (const flag of [
    'TBX{web_parameter_tampering}', 'TBX{web_idor_profile}', 'TBX{web_sqli_basic}', 'TBX{web_stored_xss}',
    'TBX{web_path_traversal}', 'TBX{web_file_upload}', 'TBX{web_ssrf_internal}', 'TBX{web_jwt_admin}',
  ]) {
    assert.equal(webGroup.includes(flag), false, `hint/problem source must not reveal ${flag}`);
  }
  assert.match(app, /すべての演習ターゲット/);
});

test('AI attachment controls default to off and support full terminal text and capture', async () => {
  const [source, styles] = await Promise.all([
    readWebSource('AssistantPanel.tsx'),
    readWebSource('styles.css'),
  ]);
  assert.match(source, /includeFullTerminalHistory, setIncludeFullTerminalHistory\] = useState\(false\)/);
  assert.match(source, /includeScreenCapture, setIncludeScreenCapture\] = useState\(false\)/);
  assert.match(source, />\s*ターミナル全文\s*</);
  assert.match(source, />\s*キャプチャ\s*</);
  assert.match(source, /html2canvas\(terminalBox/);
  assert.doesNotMatch(source, /getDisplayMedia/);
  assert.match(styles, /\.history-toggle-capture\s*\{\s*color:\s*var\(--text\)/);
});

test('tutorial includes a bounded ping reply exercise', async () => {
  const source = await readWebSource('TutorialPanel.tsx');
  assert.match(source, /title: 'ping の返答を確認する'/);
  assert.match(source, /ping -c 4 target/);
});

test('target 2 and 3 keep the original four-step challenges', async () => {
  const source = await readWebSource('ChallengePanel.tsx');
  for (const title of [
    'ストアの非公開設定を探す', '商品情報を書き換える', '偽のキャンペーンを掲載する', 'ストアの改ざん状態を確認する',
    'デバッグ設定の漏えいを調べる', '図書館の見出しを改ざんする', '偽の休館案内を掲示する', '図書館サイトの状態を確認する',
  ]) {
    assert.match(source, new RegExp(`title: '${title}'`));
  }
  assert.doesNotMatch(source, /title: 'HTTP Request Basics'/);
  assert.doesNotMatch(source, /title: 'Multi-step Challenge'/);
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
