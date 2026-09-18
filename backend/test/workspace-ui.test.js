import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readWebSource = (file) => readFile(new URL(`../../web/src/${file}`, import.meta.url), 'utf8');
const readRootSource = (file) => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');

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
  assert.match(source, /path=kali-gui\/websockify/);
  assert.match(source, /password=student/);
  assert.match(styles, /\.kali-gui-panel\.kali-view-hidden\s*\{\s*display:\s*none/);
});

test('Kali noVNC can connect and render inside the workspace frame', async () => {
  const nginx = await readRootSource('cloud/nginx-web.conf');
  const kaliLocation = nginx.slice(nginx.indexOf('location ~ ^/'), nginx.indexOf('\n  }', nginx.indexOf('location ~ ^/')));

  assert.match(kaliLocation, /kali-gui/);
  assert.match(kaliLocation, /proxy_set_header Upgrade \$http_upgrade/);
  assert.match(nginx, /add_header X-Frame-Options SAMEORIGIN always/);
});

test('online AI and security tool wording are the defaults', async () => {
  const source = await readWebSource('App.tsx');

  assert.match(source, /<AgentPanel/);
  assert.doesNotMatch(source, /assistant-local/);
  assert.match(source, />\s*セキュリティツール\s*</);
});

test('learning tabs put targets before security tools', async () => {
  const [source, styles] = await Promise.all([
    readWebSource('App.tsx'),
    readWebSource('styles.css'),
  ]);
  assert.ok(source.indexOf('id="tutorial-tab"') < source.indexOf('id="targets-tab"'));
  assert.ok(source.indexOf('id="targets-tab"') < source.indexOf('id="vulnerabilities-tab"'));
  assert.ok(source.indexOf('id="vulnerabilities-tab"') < source.indexOf('id="tools-tab"'));
  assert.doesNotMatch(source, /id="operations-tab"/);
  assert.doesNotMatch(source, /id="web-attacks-tab"/);
  assert.match(styles, /\.learning-workspace > \.workspace-tabs \{ grid-template-columns: repeat\(4,/);
});

test('AI Agent is online-only without local tabs', async () => {
  const [app, agent, styles] = await Promise.all([
    readWebSource('App.tsx'),
    readWebSource('AgentPanel.tsx'),
    readWebSource('styles.css'),
  ]);
  assert.doesNotMatch(app, /id="assistant-local-tab"/);
  assert.doesNotMatch(app, /useState<AssistantTab>/);
  assert.doesNotMatch(app, />\s*ローカル\s*</);
  assert.match(agent, /fetch\(allow \? '\/api\/agent\/approve' : '\/api\/agent\/cancel'/);
  assert.match(agent, /provider: 'gemini'/);
  assert.doesNotMatch(agent, /ollama|modelInstalled/);
  assert.doesNotMatch(styles, /\.assistant-workspace > \.workspace-tabs \{ grid-template-columns: repeat\(2,/);
});

test('Live Training Target has iframe back navigation', async () => {
  const source = await readWebSource('TargetPanel.tsx');
  assert.match(source, /contentWindow\?\.history\.back\(\)/);
  assert.match(source, />戻る<\/button>/);
  assert.match(source, /sandbox="allow-forms allow-same-origin"/);
});

test('tool and vulnerability tabs open their matching panels', async () => {
  const [app, panel, target, styles] = await Promise.all([
    readWebSource('App.tsx'),
    readWebSource('ChallengePanel.tsx'),
    readWebSource('TargetPanel.tsx'),
    readWebSource('styles.css'),
  ]);

  assert.match(app, />\s*脆弱性\s*</);
  assert.match(app, /scope="vulnerabilities"/);
  assert.match(app, /setTargetPanelId\('tools'\)/);
  assert.match(app, /setTargetPanelId\(vulnerabilityTargetId\)/);
  assert.doesNotMatch(app, /historyWithoutWebAttacksUrl/);
  assert.doesNotMatch(app, /Web Attacks/);
  assert.match(target, /http:\/\/labtarget:3100\//);
  assert.match(target, /addressLabel: 'Kali内部アドレス'/);
  assert.match(target, /proxyPath: '\/tool-target\/'/);
  assert.match(target, /linux-lab:\/\/target6-copy-fail/);
  assert.match(target, /api\/linux-lab\/reset/);
  assert.match(target, /問題6 Copy Fail/);
  assert.match(target, /ツール/);
  assert.ok(target.indexOf("{ id: 9, label: '問題9' }") < target.indexOf("{ id: 'tools', label: 'ツール' }"));
  assert.match(panel, /category: 'Web'/);
  assert.match(panel, /category: 'Linux \/ OS'/);
  assert.match(panel, /問題9 sudo設定ミス/);
  assert.match(panel, /typeof item\.id === 'number' && item\.id >= 6/);
  assert.doesNotMatch(panel, /\(\['Web', 'Linux \/ OS'\] as const\)/);
  assert.match(panel, /\/api\/challenges\/progress/);
  assert.match(panel, /completionId/);
  assert.match(styles, /\.target-site-tabs[^\n]+grid-template-columns: repeat\(10,/);
  assert.match(styles, /\.vulnerability-target-tabs/);
  assert.match(app, /現在のセッションのTerminal、Desktop、Target、Challenge、AI Agent状態/);

});

test('Linux Lab switches the existing terminal and exposes only a simulated root area', async () => {
  const [app, workspace, terminal, server, lab, proxy] = await Promise.all([
    readWebSource('App.tsx'),
    readWebSource('KaliWorkspacePanel.tsx'),
    readWebSource('TerminalPanel.tsx'),
    readFile(new URL('../src/server.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/linux-lab.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/lab-proxy.js', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /terminalMode=\{terminalMode\}/);
  assert.match(app, /linuxLabTargetId=\{linuxLabTargetId\}/);
  assert.match(workspace, /terminalMode === 'linux-lab'/);
  assert.match(terminal, /\/ws\/linux-lab\?target=\$\{linuxLabTargetId\}/);
  assert.doesNotMatch(terminal, /fitAddon\.fit\(\);\s*terminal\.focus\(\);/);
  assert.match(server, /attachLinuxLabSocket/);
  assert.match(server, /api\/linux-lab\/reset/);
  assert.match(proxy, /'\/ws\/linux-lab'/);
  assert.match(lab, /No kernel exploit, AF_ALG, container escape, or Cloud Run attack was executed/);
  assert.match(lab, /\/root\/flag\.txt/);
  assert.match(lab, /fake-training-hash/);
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
  assert.match(source, /rows=\{1\}/);
  assert.match(source, /agentUsage/);
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

test('target non-answer questions auto-complete after scored answers', async () => {
  const source = await readWebSource('ChallengePanel.tsx');
  assert.match(source, /const scoredChallenges = group\.challenges/);
  assert.match(source, /const answerCompletionIds = useMemo/);
  assert.match(source, /const nonAnswerCompletionIds = useMemo/);
  assert.match(source, /scope !== 'targets'/);
  assert.match(source, /answerCompletionIds\.every\(\(item\) => completedSet\.has\(item\)\)/);
  assert.match(source, /Promise\.all\(missing\.map\(\(item\) => setCompletion\(item, true\)\)\)/);
  assert.match(source, /ATTACK \/ UNDERSTAND \/ DEFEND がすべて正解すると自動でCLEAR/);
});

test('understand and defend choices are displayed in a shuffled order', async () => {
  const source = await readWebSource('ChallengePanel.tsx');
  assert.match(source, /function shuffledChoices/);
  assert.match(source, /choiceShuffleSeed/);
  assert.match(source, /const visibleChoices = useMemo/);
  assert.match(source, /visibleChoices\.map\(\(choice, index\)/);
  assert.match(source, /String\.fromCharCode\(65 \+ index\)/);
  assert.match(source, /toggleChoice\(choice\.id\)/);
});

test('tutorial includes the former basic operations between lessons 06 and 17', async () => {
  const source = await readWebSource('TutorialPanel.tsx');
  assert.ok(source.indexOf("id: '06'") < source.indexOf("id: '07'"));
  assert.ok(source.indexOf("id: '07'") < source.indexOf("title: 'ファイルを新規作成する'"));
  assert.ok(source.indexOf("title: '練習ファイルを片付ける'") < source.indexOf("id: '17'"));
  assert.ok(source.indexOf("id: '17'") < source.indexOf("title: 'ネットワークを確認する'"));
  assert.match(source, /id: '21'/);
});

test('target mutation commands carry the active session header', async () => {
  const [challenge, tutorial, terminal, executor] = await Promise.all([
    readWebSource('ChallengePanel.tsx'),
    readWebSource('TutorialPanel.tsx'),
    readFile(new URL('../src/terminal.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/agent/command-executor.js', import.meta.url), 'utf8'),
  ]);
  assert.match(challenge, /X-TerminalBox-Session: \$TERMINALBOX_SESSION_ID/);
  assert.match(tutorial, /X-TerminalBox-Session: \$TERMINALBOX_SESSION_ID/);
  assert.match(challenge, /-H \\"X-TerminalBox-Session: \$TERMINALBOX_SESSION_ID\\"/);
  assert.match(tutorial, /-H \\"X-TerminalBox-Session: \$TERMINALBOX_SESSION_ID\\"/);
  assert.doesNotMatch(challenge, /-H 'X-TerminalBox-Session: \$TERMINALBOX_SESSION_ID'/);
  assert.doesNotMatch(tutorial, /-H 'X-TerminalBox-Session: \$TERMINALBOX_SESSION_ID'/);
  assert.match(terminal, /TERMINALBOX_SESSION_ID: session\.sessionId/);
  assert.match(executor, /TERMINALBOX_SESSION_ID: session\?\.sessionId/);
});

test('target proxy preserves path prefixes for browser redirects', async () => {
  const [proxy, target] = await Promise.all([
    readFile(new URL('../src/target-proxy.js', import.meta.url), 'utf8'),
    readFile(new URL('../../target/src/server.js', import.meta.url), 'utf8'),
  ]);

  assert.match(proxy, /'x-terminalbox-path-prefix': route\.prefix/);
  assert.match(target, /const PATH_PREFIX_HEADER = 'x-terminalbox-path-prefix'/);
  assert.match(target, /const redirectPath = \(request, path = '\/'\)/);
  assert.match(target, /location: redirectPath\(request, '\/'\)/);
  assert.match(target, /location: redirectPath\(request, product \? `\/store\/products\/\$\{product\.id\}` : '\/'\)/);
});

test('desktop workspace uses a compact four-pane viewport grid', async () => {
  const styles = await readWebSource('styles.css');
  assert.match(styles, /html, body, #root \{[^}]*overflow: hidden/);
  assert.match(styles, /\.workspace-main \{[^}]*height: calc\(100vh - 40px\)/);
  assert.match(styles, /\.workspace-grid \{[^}]*height: 100%/);
  assert.match(styles, /\.workspace-column \{[^}]*grid-template-rows: minmax\(130px, var\(--workspace-top-fr/);
  assert.match(styles, /\.pane-resizer/);
  assert.match(styles, /@media \(max-width: 1100px\) \{[\s\S]*html, body, #root \{ height: auto; overflow: auto; \}/);
  assert.match(styles, /@media \(max-width: 1100px\) \{[\s\S]*\.pane-resizer-horizontal \{ display: block; min-height: 14px; \}/);
  assert.match(styles, /@media \(max-width: 1100px\) \{[\s\S]*grid-template-rows: minmax\(260px, var\(--workspace-top-fr/);
});

test('target 1 through 5 use attack, understand, and defend challenges', async () => {
  const source = await readWebSource('ChallengePanel.tsx');
  const target1Group = source.slice(source.indexOf('id: 1,'), source.indexOf('id: 2,'));
  const target2Group = source.slice(source.indexOf('id: 2,'), source.indexOf('id: 3,'));
  const target3Group = source.slice(source.indexOf('id: 3,'), source.indexOf('id: 4,'));
  const target4Group = source.slice(source.indexOf('id: 4,'), source.indexOf('id: 5,'));
  const target5Group = source.slice(source.indexOf('id: 5,'), source.indexOf('id: 6,'));
  assert.equal((target1Group.match(/id: '0/g) ?? []).length, 8);
  assert.equal((target2Group.match(/id: '0/g) ?? []).length, 8);
  assert.equal((target3Group.match(/id: '0/g) ?? []).length, 4);
  assert.equal((target4Group.match(/id: '0/g) ?? []).length, 4);
  assert.equal((target5Group.match(/id: '0/g) ?? []).length, 4);
  assert.match(target1Group, /answerId: 'target1'/);
  assert.match(target2Group, /answerId: 'target2'/);
  assert.match(target3Group, /answerId: 'target3'/);
  assert.match(target4Group, /answerId: 'target4'/);
  assert.match(target5Group, /answerId: 'target5'/);
  assert.match(target2Group, /ブラウザUIからログインする/);
  assert.match(target2Group, /IDOR \/ Broken Access Control/);
  assert.match(target3Group, /入力値処理/);
  assert.match(target4Group, /セッション \/ 認証/);
  assert.match(target5Group, /Defense in Depth/);
  for (const group of [target1Group, target2Group, target3Group, target4Group, target5Group]) {
    assert.match(group, /UNDERSTAND/);
    assert.match(group, /DEFEND/);
    assert.match(group, /MISSION COMPLETE/);
  }
  assert.doesNotMatch(target2Group, /store-admin-2026/);
  assert.doesNotMatch(target2Group, /store-config\.json/);
  assert.doesNotMatch(source, /title: 'HTTP Request Basics'/);
  assert.doesNotMatch(source, /title: 'Multi-step Challenge'/);
});

test('target 6 through 9 provide Linux privilege escalation courses', async () => {
  const source = await readWebSource('ChallengePanel.tsx');
  const target6Group = source.slice(source.indexOf('id: 6,'), source.indexOf('id: 7,'));
  const target7Group = source.slice(source.indexOf('id: 7,'), source.indexOf('id: 8,'));
  const target8Group = source.slice(source.indexOf('id: 8,'), source.indexOf('id: 9,'));
  const target9Group = source.slice(source.indexOf('id: 9,'), source.indexOf("id: 'tools'"));

  for (const group of [target6Group, target7Group, target8Group, target9Group]) {
    assert.equal((group.match(/id: '0/g) ?? []).length, 4);
    assert.match(group, /category: 'Linux \/ OS'/);
    assert.match(group, /UNDERSTAND/);
    assert.match(group, /DEFEND/);
    assert.match(group, /MISSION COMPLETE/);
    assert.doesNotMatch(group, /AF_ALGを利用した実攻撃/);
  }
  assert.match(target6Group, /answerId: 'target6'/);
  assert.match(target6Group, /Copy Fail/);
  assert.match(target7Group, /answerId: 'target7'/);
  assert.match(target7Group, /owner \/ group \/ rwx/);
  assert.match(target8Group, /answerId: 'target8'/);
  assert.match(target8Group, /SUID/);
  assert.match(target9Group, /answerId: 'target9'/);
  assert.match(target9Group, /sudoers/);
});
test('every learning category starts with its hint collapsed', async () => {
  const sources = await Promise.all([
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
