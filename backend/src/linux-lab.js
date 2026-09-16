const LINUX_TARGETS = new Set([6, 7, 8, 9]);

const FLAGS = Object.freeze({
  6: 'FLAG{COPY_FAIL_LPE}',
  7: 'FLAG{LINUX_PERMISSION}',
  8: 'FLAG{SUID_MISCONFIG}',
  9: 'FLAG{SUDO_MISCONFIG}',
});

const HOME_FILES = [
  'README.txt',
  'copy-fail-notes.txt',
  'permission-notes.txt',
  'suid-notes.txt',
  'sudo-notes.txt',
];

function createLinuxLabState() {
  return {
    activeTarget: 6,
    history: [],
    targetState: Object.fromEntries([...LINUX_TARGETS].map((id) => [id, {
      user: 'student',
      cwd: '/home/student',
      permissionPayload: false,
    }])),
  };
}

function getLinuxLabState(session) {
  if (!session.linuxLab) session.linuxLab = createLinuxLabState();
  return session.linuxLab;
}

export function resetLinuxLab(session) {
  session.linuxLab = createLinuxLabState();
  return session.linuxLab;
}

function normalizeTarget(value) {
  const id = Number.parseInt(String(value ?? ''), 10);
  return LINUX_TARGETS.has(id) ? id : 6;
}

function activeTargetState(state) {
  return state.targetState[state.activeTarget];
}

function shortPath(cwd) {
  return cwd === '/home/student' ? '~' : cwd;
}

function prompt(state) {
  const target = activeTargetState(state);
  const symbol = target.user === 'root' ? '#' : '$';
  return `\x1b[32m[LINUX LAB]\x1b[0m ${target.user}@linux-lab:${shortPath(target.cwd)}${symbol} `;
}

function becomeRoot(state, message) {
  const target = activeTargetState(state);
  target.user = 'root';
  target.cwd = '/root';
  return `${message}\r\nuid=0(root) gid=0(root) groups=0(root)\r\n${target.user}@linux-lab:/root#`;
}

function rootOnly(state, content) {
  if (activeTargetState(state).user !== 'root') return 'cat: permission denied: training root area is locked';
  return content;
}

function listPath(state, path) {
  const target = activeTargetState(state);
  const requested = path || target.cwd;
  if (requested === '/root') {
    return rootOnly(state, 'admin_note.txt  flag.txt');
  }
  if (requested === '/etc') return 'passwd  shadow  sudoers';
  if (requested === '/opt') return 'copy-fail  perm-lab';
  if (requested === '/opt/copy-fail') return 'README  copy_fail_demo';
  if (requested === '/opt/perm-lab') return 'maintenance.sh  run-maintenance';
  if (requested === '/usr/local/bin') return 'backup-viewer  log-viewer';
  if (requested === '/home/student' || requested === '~' || requested === '.') return HOME_FILES.join('  ');
  return `ls: cannot access '${requested}': No such file or directory`;
}

function catPath(state, path) {
  const targetId = state.activeTarget;
  const files = {
    '/home/student/README.txt': 'Linux Lab is a safe per-session simulation. Select 問題6-9 and inspect the training files.',
    '/home/student/copy-fail-notes.txt': 'Copy Fail demonstrates a kernel LPE class safely. The demo never touches the host kernel or AF_ALG.',
    '/home/student/permission-notes.txt': 'File Permission issues come from owner/group/rwx mistakes such as world-writable root-run scripts.',
    '/home/student/suid-notes.txt': 'SUID runs a binary with the file owner privileges. Unsafe SUID root programs can become privilege escalation paths.',
    '/home/student/sudo-notes.txt': 'sudoers grants delegated admin actions. Over-broad commands can hand users a root shell.',
    '/opt/copy-fail/README': '問題6 Copy Fail: inspect the simulated kernel copy bug, then run /opt/copy-fail/copy_fail_demo --simulate.',
    '/opt/perm-lab/maintenance.sh': '#!/bin/sh\n# root-run maintenance script\nprintf "daily backup complete\\n"\n',
    '/root/admin_note.txt': 'Training root note: this is a fake Linux Lab root area, not Cloud Run or Kali root.',
    '/etc/shadow': 'root:$y$terminalbox$fake-training-hash:19000:0:99999:7:::\nstudent:$y$terminalbox$fake-student-hash:19000:0:99999:7:::',
    '/root/flag.txt': FLAGS[targetId],
  };
  const normalized = path === '~' ? '/home/student/README.txt' : path;
  if (normalized === '/root/admin_note.txt' || normalized === '/etc/shadow' || normalized === '/root/flag.txt') {
    return rootOnly(state, files[normalized]);
  }
  return files[normalized] ?? `cat: ${path}: No such file or directory`;
}

function handleCommand(state, command) {
  const target = activeTargetState(state);
  const trimmed = command.trim();
  if (!trimmed) return '';
  state.history.push(trimmed);
  state.history = state.history.slice(-50);

  if (trimmed === 'help' || trimmed === 'labctl') {
    return [
      'Linux Lab commands:',
      '  labctl status',
      '  labctl target 6|7|8|9',
      '  labctl reset',
      '  ls, cat, pwd, whoami, id, uname -a, find, sudo -l',
      'All privilege escalation is simulated inside this session only.',
    ].join('\r\n');
  }
  if (trimmed === 'labctl status') {
    return `active_target=${state.activeTarget}\r\nuser=${target.user}\r\nsession_scope=isolated`;
  }
  if (trimmed === 'labctl reset') {
    const activeTarget = state.activeTarget;
    Object.assign(state, createLinuxLabState(), { activeTarget });
    return `Linux Lab Target ${activeTarget} reset.`;
  }
  if (/^labctl\s+target\s+[6789]$/.test(trimmed)) {
    state.activeTarget = Number.parseInt(trimmed.match(/[6789]$/)[0], 10);
    return `Switched to Linux Lab Target ${state.activeTarget}.`;
  }
  if (trimmed === 'clear') return '\x1b[2J\x1b[H';
  if (trimmed === 'pwd') return target.cwd;
  if (trimmed === 'whoami') return target.user;
  if (trimmed === 'id') {
    return target.user === 'root'
      ? 'uid=0(root) gid=0(root) groups=0(root)'
      : 'uid=1000(student) gid=1000(student) groups=1000(student)';
  }
  if (trimmed === 'uname -a') {
    return 'Linux linux-lab 4.8.0-copy-fail #1 SMP TerminalBox training x86_64 GNU/Linux';
  }
  if (trimmed === 'history') {
    return state.history.map((item, index) => `${index + 1}  ${item}`).join('\r\n');
  }
  if (/^cd(?:\s+(.+))?$/.test(trimmed)) {
    const next = trimmed.match(/^cd(?:\s+(.+))?$/)[1] ?? '/home/student';
    const allowed = new Set(['/home/student', '~', '/root', '/opt', '/opt/copy-fail', '/opt/perm-lab', '/usr/local/bin']);
    if (next === '/root' && target.user !== 'root') return 'cd: /root: Permission denied';
    if (!allowed.has(next)) return `cd: ${next}: No such file or directory`;
    target.cwd = next === '~' ? '/home/student' : next;
    return '';
  }
  if (/^ls(?:\s+(.+))?$/.test(trimmed)) {
    return listPath(state, trimmed.match(/^ls(?:\s+(.+))?$/)[1]);
  }
  if (/^cat\s+(.+)$/.test(trimmed)) {
    return catPath(state, trimmed.match(/^cat\s+(.+)$/)[1].trim());
  }
  if (trimmed === '/opt/copy-fail/copy_fail_demo --explain') {
    return 'Copy Fail simulation: a kernel copy bug can corrupt privilege checks. This lab models the outcome without running a kernel exploit.';
  }
  if (trimmed === '/opt/copy-fail/copy_fail_demo --simulate') {
    state.activeTarget = 6;
    return becomeRoot(state, 'Copy Fail LPE simulation completed. No kernel exploit, AF_ALG, container escape, or Cloud Run attack was executed.');
  }
  if (trimmed.includes('/opt/perm-lab/maintenance.sh') && /(>|tee)/.test(trimmed)) {
    state.targetState[7].permissionPayload = true;
    return 'maintenance.sh updated in the Linux Lab overlay.';
  }
  if (trimmed === 'ls -l /opt/perm-lab/maintenance.sh') {
    return '-rwxrwxrwx 1 root root 68 Sep 15 09:00 /opt/perm-lab/maintenance.sh';
  }
  if (trimmed === '/opt/perm-lab/run-maintenance') {
    state.activeTarget = 7;
    if (!activeTargetState(state).permissionPayload) {
      return 'daily backup complete\r\nHint: the root-run maintenance script is writable by everyone.';
    }
    return becomeRoot(state, 'World-writable root-run script simulation completed.');
  }
  if (trimmed === 'find / -perm -4000 -type f 2>/dev/null') {
    return ['/usr/bin/passwd', '/usr/bin/su', '/usr/local/bin/backup-viewer'].join('\r\n');
  }
  if (trimmed === 'ls -l /usr/local/bin/backup-viewer') {
    return '-rwsr-xr-x 1 root root 18400 Sep 15 09:00 /usr/local/bin/backup-viewer';
  }
  if (trimmed === '/usr/local/bin/backup-viewer --root-shell') {
    state.activeTarget = 8;
    return becomeRoot(state, 'Unsafe SUID helper simulation completed.');
  }
  if (trimmed === 'sudo -l') {
    return [
      'Matching Defaults entries for student on linux-lab:',
      '    env_reset, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      '',
      'User student may run the following commands on linux-lab:',
      '    (root) NOPASSWD: /usr/local/bin/log-viewer',
    ].join('\r\n');
  }
  if (trimmed === 'sudo /usr/local/bin/log-viewer --root-shell') {
    state.activeTarget = 9;
    return becomeRoot(state, 'Over-broad sudoers rule simulation completed.');
  }
  if (/^(sudo|su|docker|kubectl|nsenter|mount)\b/.test(trimmed)) {
    return `${trimmed.split(/\s+/)[0]}: blocked in Linux Lab simulation`;
  }
  return `${trimmed}: command is not available in the Linux Lab simulation`;
}

export function attachLinuxLabSocket(socket, request, session) {
  let state = getLinuxLabState(session);
  const url = new URL(request.url ?? '/', 'http://localhost');
  state.activeTarget = normalizeTarget(url.searchParams.get('target'));
  let lineBuffer = '';

  const sendOutput = (data) => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'output', data }));
  };
  const send = (type, payload = {}) => {
    if (socket.readyState === 1) socket.send(JSON.stringify({ type, ...payload }));
  };

  send('ready');
  sendOutput([
    '\r\n[LINUX LAB] TerminalBox safe privilege escalation lab',
    'This shell is simulated per Session ID. It never attacks the host kernel, container, or Cloud Run.',
    `Active Target: ${state.activeTarget}`,
    'Type help for available commands.',
    '',
    prompt(state),
  ].join('\r\n'));

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type !== 'input' || typeof message.data !== 'string') return;
      if (session.linuxLab !== state) {
        state = getLinuxLabState(session);
        state.activeTarget = normalizeTarget(url.searchParams.get('target'));
      }
      for (const char of message.data.slice(0, 8192)) {
        if (char === '\u0003') {
          lineBuffer = '';
          sendOutput('^C\r\n' + prompt(state));
          continue;
        }
        if (char === '\u007f' || char === '\b') {
          if (lineBuffer) {
            lineBuffer = lineBuffer.slice(0, -1);
            sendOutput('\b \b');
          }
          continue;
        }
        if (char === '\r' || char === '\n') {
          const command = lineBuffer;
          lineBuffer = '';
          const output = handleCommand(state, command);
          sendOutput(`\r\n${output ? `${output}\r\n` : ''}${prompt(state)}`);
          continue;
        }
        if (lineBuffer.length < 4096) {
          lineBuffer += char;
          sendOutput(char);
        }
      }
    } catch {
      send('error', { message: 'Invalid Linux Lab message' });
    }
  });
}
