import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  refreshSignal: number;
  targetId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'tools';
  onTargetChange: (targetId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'tools') => void;
}

const targetDefinitions = {
  1: { kind: 'iframe', address: 'http://target:3000/', proxyPath: '/target-site/', label: '問題1 研修サイト', addressLabel: 'Kali内部アドレス' },
  2: { kind: 'iframe', address: 'http://target2:3000/', proxyPath: '/target-site-2/', label: '問題2 オンラインストア', addressLabel: 'Kali内部アドレス' },
  3: { kind: 'iframe', address: 'http://target3:3000/', proxyPath: '/target-site-3/', label: '問題3 入力値処理', addressLabel: 'Kali内部アドレス' },
  4: { kind: 'iframe', address: 'http://target4:3000/', proxyPath: '/target-site-4/', label: '問題4 セッション / 認証', addressLabel: 'Kali内部アドレス' },
  5: { kind: 'iframe', address: 'http://target5:3000/', proxyPath: '/target-site-5/', label: '問題5 Defense in Depth', addressLabel: 'Kali内部アドレス' },
  tools: { kind: 'iframe', address: 'http://labtarget:3100/', proxyPath: '/tool-target/', label: 'セキュリティツール ターゲット', addressLabel: 'Kali内部アドレス' },
  6: { kind: 'linux-lab', address: 'linux-lab://target6-copy-fail', label: '問題6 Copy Fail', addressLabel: 'Linux Lab', course: 'Linux Kernel LPE' },
  7: { kind: 'linux-lab', address: 'linux-lab://target7-file-permission', label: '問題7 File Permission', addressLabel: 'Linux Lab', course: 'owner / group / rwx' },
  8: { kind: 'linux-lab', address: 'linux-lab://target8-suid', label: '問題8 SUID設定ミス', addressLabel: 'Linux Lab', course: 'SUID root helper' },
  9: { kind: 'linux-lab', address: 'linux-lab://target9-sudo', label: '問題9 sudo設定ミス', addressLabel: 'Linux Lab', course: 'sudoers delegation' },
} as const;

const targetTabs = [
  { id: 1, label: '問題1' },
  { id: 2, label: '問題2' },
  { id: 3, label: '問題3' },
  { id: 4, label: '問題4' },
  { id: 5, label: '問題5' },
  { id: 'tools', label: 'ツール' },
  { id: 6, label: '問題6' },
  { id: 7, label: '問題7' },
  { id: 8, label: '問題8' },
  { id: 9, label: '問題9' },
] as const;

export function TargetPanel({ refreshSignal, targetId, onTargetChange }: Props) {
  const [frameVersion, setFrameVersion] = useState(0);
  const [resetting, setResetting] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const refresh = useCallback(() => setFrameVersion((value) => value + 1), []);
  const goBack = useCallback(() => frameRef.current?.contentWindow?.history.back(), []);
  const target = targetDefinitions[targetId];

  useEffect(() => {
    if (refreshSignal > 0) refresh();
  }, [refresh, refreshSignal]);

  const resetTarget = async () => {
    setResetting(true);
    try {
      await fetch(target.kind === 'linux-lab' ? '/api/linux-lab/reset' : `${target.proxyPath}api/lab/reset`, { method: 'POST' });
      refresh();
    } finally {
      setResetting(false);
    }
  };

  return (
    <section className="panel target-panel" id="target-panel" aria-labelledby="target-panel-title">
      <div className="panel-heading target-heading">
        <h2 id="target-panel-title">{target.label}</h2>
        <div className="target-actions">
          <button type="button" onClick={goBack}>戻る</button>
          <button type="button" onClick={refresh}>再読み込み</button>
          <button type="button" onClick={resetTarget} disabled={resetting}>{resetting ? 'リセット中' : 'HPを復元'}</button>
        </div>
      </div>
      <div className="target-site-tabs" role="tablist" aria-label="ターゲットサイト">
        {targetTabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={targetId === id}
            className={targetId === id ? 'active' : ''}
            onClick={() => onTargetChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="target-address-bar">
        <span aria-hidden="true">●</span>
        <strong>{target.addressLabel}</strong>
        <input type="text" value={target.address} readOnly aria-label="ターゲットサイトのアドレス" />
        <button type="button" onClick={refresh} aria-label="ターゲットサイトを再読み込み" title="再読み込み">↻</button>
      </div>
      {target.kind === 'linux-lab' ? (
        <div className="target-frame linux-lab-frame">
          <span>LINUX LAB</span>
          <h3>{target.label}</h3>
          <p>{target.course}</p>
          <p>上のTerminalが [LINUX LAB] student@linux-lab:~$ に切り替わります。root取得と /root/flag.txt はこのSession ID内の安全な演習用シミュレーションです。</p>
        </div>
      ) : (
        <iframe ref={frameRef} key={`${targetId}-${frameVersion}`} className="target-frame" src={target.proxyPath} title={target.label} sandbox="allow-forms allow-same-origin" />
      )}
    </section>
  );
}
