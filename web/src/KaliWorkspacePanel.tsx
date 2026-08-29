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
  burp: 'nohup terminalbox-activate-tool burp >/tmp/terminalbox-activate-burp.log 2>&1 &\r',
  wireshark: 'nohup terminalbox-activate-tool wireshark >/tmp/terminalbox-activate-wireshark.log 2>&1 &\r',
  desktop: 'terminalbox-activate-tool desktop\r',
};

export function KaliWorkspacePanel({ onHistoryChange, pasteRequest }: Props) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('terminal');
  const [guiInitialized, setGuiInitialized] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<PasteRequest | null>(pasteRequest);

  useEffect(() => {
    if (pasteRequest) setTerminalRequest(pasteRequest);
  }, [pasteRequest]);

  const selectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    if (tab !== 'terminal') setGuiInitialized(true);
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
      {guiInitialized && (
        <section className={guiVisible ? 'panel kali-gui-panel' : 'panel kali-gui-panel kali-view-hidden'} role="tabpanel" aria-label={activeDefinition.label} aria-hidden={!guiVisible}>
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
