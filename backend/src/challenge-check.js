import { linuxLabFlag } from './linux-lab.js';

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
  ['target1-understand', 'A'],
  ['target1-defend', 'A,B,C'],
  ['target2-understand', 'A'],
  ['target2-defend', 'A,B,C'],
  ['target3-understand', 'A'],
  ['target3-defend', 'A,B,C'],
  ['target4-understand', 'A'],
  ['target4-defend', 'A,B,C,D'],
  ['target5-understand', 'A'],
  ['target5-defend', 'A,B,C,D'],
  ['target6-understand', 'A'],
  ['target6-defend', 'A,B,C'],
  ['target7-understand', 'A'],
  ['target7-defend', 'A,B,C'],
  ['target8-understand', 'A'],
  ['target8-defend', 'A,B,C'],
  ['target9-understand', 'A'],
  ['target9-defend', 'A,B,C'],
]);

function normalizeAnswer(id, answer) {
  const trimmed = answer.trim();
  if (id.endsWith('-defend')) {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .sort()
      .join(',');
  }
  return trimmed;
}

export function checkChallengeAnswer(id, answer, sessionId) {
  const linuxTargetMatch = typeof id === 'string' ? id.match(/^target([6-9])$/) : null;
  const expected = typeof id === 'string'
    ? answers.get(id) ?? (linuxTargetMatch && typeof sessionId === 'string' ? linuxLabFlag(sessionId, linuxTargetMatch[1]) : null)
    : null;
  if (expected === null || expected === undefined) return { status: 404, body: { error: 'Unknown challenge' } };
  if (typeof answer !== 'string' || answer.trim().length < 1 || answer.length > 200) {
    return { status: 400, body: { error: '回答を入力してください。' } };
  }
  const correct = normalizeAnswer(id, answer) === expected;
  return {
    status: 200,
    body: {
      correct,
      message: correct ? '正解です。問題をクリアしました。' : '一致しません。出力をもう一度確認してください。',
    },
  };
}
