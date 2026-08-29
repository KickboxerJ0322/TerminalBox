import { useEffect, useState } from 'react';
import { TerminalPanel } from './TerminalPanel';

interface PasteRequest {
  id: number;
  text: string;
}

interface Props {
  onHistoryChange: (history: string) => void;
  pasteRequest: PasteRequest | null;
}

type WorkspaceTab = 'terminal' | 'burp' | 'wireshark' | 'desktop';

const workspaceTabs: Array<{ id: WorkspaceTab; icon: string; label: string }> = [
  { id: 'terminal', icon: '_', label: 'Terminal' },
  { id: 'burp', icon: 'B', label: 'Burp Suite' },
  { id: 'wireshark', icon: 'W', label: 'Wireshark' },
  { id: 'desktop', icon: '🖥', label: 'Kali Desktop' },
];

const launchCommands: Partial<Record<WorkspaceTab, string>> = {
  burp: "pgrep -f '[b]urpsuite' >/dev/null || (DISPLAY=:1 XAUTHORITY=/home/student/.Xauthority nohup burpsuite >/tmp/burpsuite.log 2>&1 &)\r",
  wireshark: "pgrep -x wireshark >/dev/null || (DISPLAY=:1 XAUTHORITY=/home/student/.Xauthority nohup wireshark ~/TerminalBox-Labs/capture.pcapng >/tmp/wireshark.log 2>&1 &)\r",
};

export function KaliWorkspacePanel({ onHistoryChange, pasteRequest }: Props) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('terminal');
  const [terminalRequest, setTerminalRequest] = useState<PasteRequest | null>(pasteRequest);

  useEffect(() => {
    if (pasteRequest) setTerminalRequest(pasteRequest);
  }, [pasteRequest]);

  const selectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    const command = launchCommands[tab];
    if (command) setTerminalRequest({ id: Date.now(), text: command });
  };

  const activeDefinition = workspaceTabs.find((tab) => tab.id === activeTab) ?? workspaceTabs[0];
  const guiVisible = activeTab !== 'terminal';

  return (
    <aside className="side-workspace kali-workspace" aria-label="Kaliワークスペース">
      <div className="workspace-tabs kali-workspace-tabs" role="tablist" aria-label="Kaliワークスペース">
        {workspaceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => selectTab(tab.id)}
          >
            <span aria-hidden="true">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>
      <div className={guiVisible ? 'kali-terminal-view kali-view-hidden' : 'kali-terminal-view'} aria-hidden={guiVisible}>
        <TerminalPanel onHistoryChange={onHistoryChange} pasteRequest={terminalRequest} />
      </div>
      {guiVisible && (
        <section className="panel kali-gui-panel" role="tabpanel" aria-label={activeDefinition.label}>
          <div className="panel-heading">
            <div><span className="eyebrow">WORKSPACE / KALI</span><h2>{activeDefinition.label}</h2></div>
            <a className="gui-link" href="/kali-gui/?autoconnect=1&resize=remote" target="_blank" rel="noopener noreferrer">別画面で開く</a>
          </div>
          <p className="kali-gui-note">
            {activeTab === 'desktop' ? 'Kali Desktopを表示しています。' : `${activeDefinition.label}をKali Desktopで起動しています。表示まで数秒かかることがあります。`}
          </p>
          <iframe
            className="kali-gui-frame"
            src="/kali-gui/?autoconnect=1&resize=remote"
            title={activeDefinition.label}
          />
        </section>
      )}
    </aside>
  );
}
