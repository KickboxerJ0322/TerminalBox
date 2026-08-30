const answers = new Map([
  ['burp', 'TBX{burp_repeater_2026}'],
  ['wireshark', 'TBX{tshark_http_pcap}'],
  ['gobuster', 'TBX{gobuster_hidden_backup}'],
  ['nikto', 'TBX{nikto_server_status}'],
  ['sqlmap', 'TBX{sqlmap_sqlite_inventory}'],
  ['john', 'summer2026'],
  ['hashcat', 'terminalbox'],
  ['netcat', 'TBX{netcat_line_protocol}'],
  ['hydra', 'TBX{hydra_bounded_login}'],
  ['metasploit', 'TBX{metasploit_auxiliary_scan}'],
  ['web-parameter', 'TBX{web_parameter_tampering}'],
  ['web-idor', 'TBX{web_idor_profile}'],
  ['web-sqli', 'TBX{web_sqli_basic}'],
  ['web-xss', 'TBX{web_stored_xss}'],
  ['web-traversal', 'TBX{web_path_traversal}'],
  ['web-upload', 'TBX{web_file_upload}'],
  ['web-ssrf', 'TBX{web_ssrf_internal}'],
  ['web-jwt', 'TBX{web_jwt_admin}'],
]);

export function checkChallengeAnswer(id, answer) {
  if (typeof id !== 'string' || !answers.has(id)) return { status: 404, body: { error: 'Unknown challenge' } };
  if (typeof answer !== 'string' || answer.trim().length < 1 || answer.length > 200) {
    return { status: 400, body: { error: '回答を入力してください。' } };
  }
  const correct = answer.trim() === answers.get(id);
  return {
    status: 200,
    body: {
      correct,
      message: correct ? '正解です。問題をクリアしました。' : '一致しません。出力をもう一度確認してください。',
    },
  };
}
