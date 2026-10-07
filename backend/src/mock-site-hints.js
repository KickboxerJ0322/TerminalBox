export function mockHints(site) {
  const commerce=site.definition.type==='commerce';
  const request=(path,options='')=>`curl -sS --max-time 10 -H "X-TerminalBox-Session: $TERMINALBOX_SESSION_ID" ${options} "http://mocksite:3200/vulnerable${path}"; printf '\\n'`;
  const records=commerce?'orders':'reports';
  const hints={
    input:{title:'入力値処理：検索条件の変化を確認',steps:[
      {text:'通常の検索結果を確認します。空の検索語では一覧を取得できます。',command:request('/api/search?q=')},
      {text:'検索語に条件式を入れます。trainingSecret が返ると、この教材の入力値処理MISSIONは達成です。実際のDBには接続しないシミュレーションです。',command:request('/api/search?q=%27%20OR%201%3D1%20--')},
      {text:'同じコマンドの /vulnerable/ を /secure/ に変更すると、秘密情報が返らないことを比較できます。'}]},
    auth:{title:'認証・セッション：トークンの権限検証',steps:[
      {text:'student用の模擬トークンを取得します。返されたtokenはBase64URL形式で、署名のないJSONです。',command:request('/api/login')},
      {text:'roleをadminにした模擬トークンを指定します。admin:true が返ると達成です。この固定トークンは教材用です。',command:request('/api/admin?token=eyJyb2xlIjoiYWRtaW4ifQ')},
      {text:'Secure版では同じトークンが拒否されます。権限は利用者が書き換えられる値だけで決定してはいけません。'}]},
    authorization:{title:`認可：他の利用者の${commerce?'注文':'保存レポート'}へのアクセス`,steps:[
      {text:'自分のID 1001を開き、ownerがstudentであることを確認します。',command:request(`/api/${records}/1001`)},
      {text:'IDだけを1002に変えます。owner:other-user のデータが返ると達成です。',command:request(`/api/${records}/1002`)},
      {text:'Secure版では1002へのアクセスが拒否されます。IDの存在だけでなく所有者の照合が必要です。'}]},
    web:commerce?{title:'Web攻撃：購入価格の改変',steps:[
      {text:'通常の購入処理を確認します。対策版は常にサーバーの正規価格を使います。',command:request('/api/checkout',"-X POST -d 'price=1000'")},
      {text:'送信価格を1に変更します。paid:1 が返ると達成です。実決済は行いません。',command:request('/api/checkout',"-X POST -d 'price=1'")},
      {text:'Secure版で同じ入力を送信し、paidが正規価格になることを確認します。'}]}:{title:'Web攻撃：非公開レポートの公開設定を改変',steps:[
      {text:'レポートを非公開で保存し、visibility:private を確認します。',command:request('/api/publish',"-X POST -d 'visibility=private'")},
      {text:'送信する公開設定をpublicに変えます。visibility:public が返ると達成です。架空の教材データだけが対象です。',command:request('/api/publish',"-X POST -d 'visibility=public'")},
      {text:'Secure版では同じ入力でもprivateのままです。更新可能な項目と権限をサーバーで制限する必要があります。'}]},
  };
  return site.themes.map(theme=>({theme,...hints[theme]}));
}
