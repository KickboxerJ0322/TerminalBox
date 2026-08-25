interface CommandItem {
  command: string;
  meaning: string;
  usage: string;
}

const commandGroups: Array<{ title: string; items: CommandItem[] }> = [
  {
    title: '場所と一覧',
    items: [
      { command: 'pwd', meaning: '現在の作業場所を表示する', usage: 'pwd' },
      { command: 'ls', meaning: 'ファイルやディレクトリを一覧表示する', usage: 'ls -la' },
      { command: 'cd', meaning: '作業するディレクトリを移動する', usage: 'cd ~/Desktop' },
      { command: 'find', meaning: '条件に合うファイルを探す', usage: 'find ~/Desktop -type f' },
    ],
  },
  {
    title: 'ファイル操作',
    items: [
      { command: 'touch', meaning: '空のファイルを新規作成する', usage: 'touch memo.txt' },
      { command: 'mkdir', meaning: 'ディレクトリを新規作成する', usage: 'mkdir -p work/logs' },
      { command: 'cp', meaning: 'ファイルやディレクトリをコピーする', usage: 'cp memo.txt backup.txt' },
      { command: 'mv', meaning: '移動または名前を変更する', usage: 'mv old.txt new.txt' },
      { command: 'rm', meaning: 'ファイルを削除する', usage: 'rm memo.txt' },
    ],
  },
  {
    title: '読み取りと編集',
    items: [
      { command: 'cat', meaning: 'ファイル全体を表示する', usage: 'cat memo.txt' },
      { command: 'head / tail', meaning: '先頭または末尾だけを表示する', usage: 'tail -n 20 app.log' },
      { command: 'less', meaning: '長いファイルをページ単位で読む', usage: 'less /etc/passwd' },
      { command: 'nano', meaning: 'ターミナル上でファイルを編集する', usage: 'nano memo.txt' },
      { command: '> / >>', meaning: '出力を上書き保存／追記する', usage: 'echo "hello" >> memo.txt' },
    ],
  },
  {
    title: '検索と集計',
    items: [
      { command: 'grep', meaning: '文字列に一致する行を探す', usage: 'grep -n "error" app.log' },
      { command: 'sort', meaning: '行を並べ替える', usage: 'sort names.txt' },
      { command: 'uniq', meaning: '連続する重複行をまとめる', usage: 'sort names.txt | uniq -c' },
      { command: 'wc', meaning: '行数・単語数・バイト数を数える', usage: 'wc -l app.log' },
    ],
  },
  {
    title: '権限とプロセス',
    items: [
      { command: 'whoami / id', meaning: '実行中のユーザーとグループを確認する', usage: 'id' },
      { command: 'chmod', meaning: 'ファイルの権限を変更する', usage: 'chmod 600 secret.txt' },
      { command: 'ps', meaning: '動作中のプロセスを表示する', usage: 'ps aux' },
      { command: 'kill', meaning: 'プロセスへ終了シグナルを送る', usage: 'kill 1234' },
    ],
  },
  {
    title: 'ネットワーク',
    items: [
      { command: 'ip', meaning: 'ネットワーク設定を確認する', usage: 'ip a' },
      { command: 'ss', meaning: '接続や待受ポートを確認する', usage: 'ss -tuln' },
      { command: 'curl', meaning: 'HTTPなどの通信を送る', usage: 'curl -i http://target:3000/' },
      { command: 'getent hosts', meaning: 'ホスト名の名前解決を確認する', usage: 'getent hosts target' },
    ],
  },
];

export function CommandGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="info-overlay" role="presentation" onClick={onClose}>
      <section className="info-dialog command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-title" onClick={(event) => event.stopPropagation()}>
        <div className="info-heading">
          <div><span className="eyebrow">LINUX QUICK REFERENCE</span><h2 id="command-title">基本コマンド一覧</h2></div>
          <button type="button" aria-label="閉じる" onClick={onClose}>×</button>
        </div>
        <div className="command-guide-content">
          {commandGroups.map((group) => (
            <section className="command-group" key={group.title}>
              <h3>{group.title}</h3>
              <div className="command-table">
                {group.items.map((item) => (
                  <article key={item.command}>
                    <code>{item.command}</code>
                    <span>{item.meaning}</span>
                    <code>{item.usage}</code>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
