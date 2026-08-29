import { useCallback, useEffect, useState } from 'react';

interface Props {
  refreshSignal: number;
  targetId: 1 | 2 | 3 | 4;
  onTargetChange: (targetId: 1 | 2 | 3 | 4) => void;
}

const targetDefinitions = {
  1: { address: 'http://target:3000/', proxyPath: '/target-site/', label: '問題1 研修サイト' },
  2: { address: 'http://target2:3000/', proxyPath: '/target-site-2/', label: '問題2 オンラインストア' },
  3: { address: 'http://target3:3000/', proxyPath: '/target-site-3/', label: '問題3 図書館サイト' },
  4: { address: 'http://labtarget:3100/', proxyPath: '/tool-target/', label: '問題4 セキュリティツール演習' },
} as const;

export function TargetPanel({ refreshSignal, targetId, onTargetChange }: Props) {
  const [frameVersion, setFrameVersion] = useState(0);
  const [resetting, setResetting] = useState(false);
  const refresh = useCallback(() => setFrameVersion((value) => value + 1), []);
  const target = targetDefinitions[targetId];

  useEffect(() => {
    if (refreshSignal > 0) refresh();
  }, [refresh, refreshSignal]);

  const resetTarget = async () => {
    setResetting(true);
    try {
      await fetch(`${target.proxyPath}api/lab/reset`, { method: 'POST' });
      refresh();
    } finally {
      setResetting(false);
    }
  };

  return (
    <section className="panel target-panel" id="target-panel" aria-labelledby="target-panel-title">
      <div className="panel-heading target-heading">
        <div><span className="eyebrow">LIVE TRAINING TARGET</span><h2 id="target-panel-title">{target.label}</h2></div>
        <div className="target-actions">
          <button type="button" onClick={refresh}>再読み込み</button>
          <button type="button" onClick={resetTarget} disabled={resetting}>{resetting ? 'リセット中' : 'HPを復元'}</button>
        </div>
      </div>
      <div className="target-site-tabs" role="tablist" aria-label="ターゲットサイト">
        {([1, 2, 3, 4] as const).map((id) => (
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
        <input type="text" value={target.address} readOnly aria-label="ターゲットサイトのアドレス" />
        <button type="button" onClick={refresh} aria-label="ターゲットサイトを再読み込み" title="再読み込み">↻</button>
      </div>
      <iframe key={`${targetId}-${frameVersion}`} className="target-frame" src={target.proxyPath} title={target.label} sandbox="allow-forms" />
    </section>
  );
}
