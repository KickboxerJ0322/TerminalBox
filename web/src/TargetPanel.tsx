import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  refreshSignal: number;
  targetId: 1 | 2 | 3 | 4 | 5 | 'tools' | 'web-attacks';
  onTargetChange: (targetId: 1 | 2 | 3 | 4 | 5) => void;
}

const targetDefinitions = {
  1: { address: 'http://target:3000/', proxyPath: '/target-site/', label: '問題1 研修サイト', addressLabel: 'Kali内部アドレス' },
  2: { address: 'http://target2:3000/', proxyPath: '/target-site-2/', label: '問題2 オンラインストア', addressLabel: 'Kali内部アドレス' },
  3: { address: 'http://target3:3000/', proxyPath: '/target-site-3/', label: '問題3 入力値処理', addressLabel: 'Kali内部アドレス' },
  4: { address: 'http://target4:3000/', proxyPath: '/target-site-4/', label: '問題4 セッション / 認証', addressLabel: 'Kali内部アドレス' },
  5: { address: 'http://target5:3000/', proxyPath: '/target-site-5/', label: '問題5 Defense in Depth', addressLabel: 'Kali内部アドレス' },
  tools: { address: 'http://labtarget:3100/', proxyPath: '/tool-target/', label: 'セキュリティツール ターゲット', addressLabel: 'Kali内部アドレス' },
  'web-attacks': { address: 'http://labtarget:3100/web-attacks/', proxyPath: '/tool-target/web-attacks/', label: 'Web Attacks ターゲット', addressLabel: 'Kali内部アドレス', resetPath: '/tool-target/web-attacks/api/lab/reset' },
} as const;

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
      await fetch('resetPath' in target ? target.resetPath : `${target.proxyPath}api/lab/reset`, { method: 'POST' });
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
        {([1, 2, 3, 4, 5] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={targetId === id}
            className={targetId === id ? 'active' : ''}
            onClick={() => onTargetChange(id)}
          >
            問題{id}
          </button>
        ))}
      </div>
      <div className="target-address-bar">
        <span aria-hidden="true">●</span>
        <strong>{target.addressLabel}</strong>
        <input type="text" value={target.address} readOnly aria-label="ターゲットサイトのアドレス" />
        <button type="button" onClick={refresh} aria-label="ターゲットサイトを再読み込み" title="再読み込み">↻</button>
      </div>
      <iframe ref={frameRef} key={`${targetId}-${frameVersion}`} className="target-frame" src={target.proxyPath} title={target.label} sandbox="allow-forms allow-same-origin" />
    </section>
  );
}
