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

  assert.match(source, /useState<AssistantTab>\('online'\)/);
  assert.match(source, /setAssistantTab\('online'\)/);
  assert.match(source, />\s*繧ｻ繧ｭ繝･繝ｪ繝・ぅ繝・・繝ｫ\s*</);
});

test('learning tabs put targets before security tools', async () => {
  const source = await readWebSource('App.tsx');
  assert.ok(source.indexOf('id="operations-tab"') < source.indexOf('id="tutorial-tab"'));
  assert.ok(source.indexOf('id="tutorial-tab"') < source.indexOf('id="targets-tab"'));
  assert.ok(source.indexOf('id="targets-tab"') < source.indexOf('id="tools-tab"'));
  assert.ok(source.indexOf('id="tools-tab"') < source.indexOf('id="web-attacks-tab"'));
});

test('AI Agent tabs are online and local with online selected by default', async () => {
  const [app, agent, styles] = await Promise.all([
    readWebSource('App.tsx'),
    readWebSource('AgentPanel.tsx'),
    readWebSource('styles.css'),
  ]);
  assert.ok(app.indexOf('id="assistant-online-tab"') < app.indexOf('id="assistant-local-tab"'));
  assert.doesNotMatch(app, /id="assistant-agent-tab"/);
  assert.match(app, /useState<AssistantTab>\('online'\)/);
  assert.match(app, />\s*オンライン\s*</);
  assert.match(app, />\s*ローカル\s*</);
  assert.match(agent, /fetch\(allow \? '\/api\/agent\/approve' : '\/api\/agent\/cancel'/);
  assert.match(agent, /provider: 'gemini' \| 'local'/);
  assert.match(styles, /\.assistant-workspace > \.workspace-tabs \{ grid-template-columns: repeat\(2,/);
});

test('Live Training Target has iframe back navigation', async () => {
  const source = await readWebSource('TargetPanel.tsx');
  assert.match(source, /contentWindow\?\.history\.back\(\)/);
  assert.match(source, />戻る<\/button>/);
  assert.match(source, /sandbox="allow-forms allow-same-origin"/);
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
  assert.match(panel, /subtitle: 'Web Attacks/);

  const webGroup = panel.slice(panel.indexOf("id: 5,"), panel.indexOf('\n];', panel.indexOf("id: 5,")));
  assert.equal((webGroup.match(/hint: '/g) ?? []).length, 8);
  for (const flag of [
    'TBX{web_parameter_tampering}', 'TBX{web_idor_profile}', 'TBX{web_sqli_basic}', 'TBX{web_stored_xss}',
    'TBX{web_path_traversal}', 'TBX{web_file_upload}', 'TBX{web_ssrf_internal}', 'TBX{web_jwt_admin}',
  ]) {
    assert.equal(webGroup.includes(flag), false, `hint/problem source must not reveal ${flag}`);
  }
  assert.match(app, /現在のセッションのTerminal、Desktop、Target、Challenge、AI Agent状態/);

});
test('AI attachment controls default to off and support full terminal text and capture', async () => {
  const [source, attachments, styles] = await Promise.all([
    readWebSource('AgentPanel.tsx'),
    readWebSource('ai-attachments.ts'),
    readWebSource('styles.css'),
  ]);
  assert.match(source, /includeFullTerminalHistory, setIncludeFullTerminalHistory\] = useState\(false\)/);
  assert.match(source, /includeScreenCapture, setIncludeScreenCapture\] = useState\(false\)/);
  assert.match(source, /entries[\s\S]*slice\(-6\)/);
  assert.match(source, /includeFullTerminalHistory \? 'full' : 'recent'/);
  assert.match(source, /screenCapture,/);
  assert.match(attachments, /html2canvas\(terminalBox/);
  assert.doesNotMatch(attachments, /getDisplayMedia/);
  assert.match(styles, /\.history-toggle-capture\s*\{\s*color:\s*var\(--muted\)/);
});

test('AI Agent keeps its send controls visible and supports the same attachments', async () => {
  const [source, app, styles] = await Promise.all([
    readWebSource('AgentPanel.tsx'),
    readWebSource('App.tsx'),
    readWebSource('styles.css'),
  ]);
  assert.match(source, /includeConversationHistory, setIncludeConversationHistory\] = useState\(true\)/);
  assert.match(source, /includeTerminalHistory, setIncludeTerminalHistory\] = useState\(true\)/);
  assert.match(source, /includeFullTerminalHistory, setIncludeFullTerminalHistory\] = useState\(false\)/);
  assert.match(source, /includeScreenCapture, setIncludeScreenCapture\] = useState\(false\)/);
  assert.match(source, /includeConversationHistory \? entries/);
  assert.match(source, /includeTerminalHistory \? terminalHistory : ''/);
  assert.match(source, /includeFullTerminalHistory \? 'full' : 'recent'/);
  assert.match(source, /screenCapture,/);
  assert.match(source, /loading \? '送信中' : '送信'/);
  assert.match(app, /terminalHistory=\{history\}[\s\S]*fullTerminalHistory=\{fullTerminalHistory\}/);
  assert.match(styles, /\.agent-panel \.messages\s*\{\s*min-height:\s*0/);
  assert.match(styles, /\.agent-panel \.chat-form\s*\{\s*flex:\s*0 0 auto/);
});

test('tutorial includes a bounded ping reply exercise', async () => {
  const source = await readWebSource('TutorialPanel.tsx');
  assert.match(source, /title: 'ping の返答を確認する'/);
  assert.match(source, /ping -c 4 target/);
});

test('target 2 and 3 keep the original four-step challenges', async () => {
  const source = await readWebSource('ChallengePanel.tsx');
  const target2Group = source.slice(source.indexOf('id: 2,'), source.indexOf('id: 3,'));
  const target3Group = source.slice(source.indexOf('id: 3,'), source.indexOf('id: 4,'));
  assert.equal((target2Group.match(/id: '0/g) ?? []).length, 4);
  assert.equal((target3Group.match(/id: '0/g) ?? []).length, 4);
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
