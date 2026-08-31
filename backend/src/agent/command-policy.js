export const CommandClassification = Object.freeze({
  READ_ONLY: 'READ_ONLY',
  CONFIRM_REQUIRED: 'CONFIRM_REQUIRED',
  DENIED: 'DENIED',
});

const READ_ONLY_COMMANDS = new Set([
  'pwd', 'whoami', 'id', 'hostname', 'uname', 'date', 'uptime',
  'ls', 'stat', 'file', 'wc', 'head', 'tail', 'cat', 'grep', 'find', 'sed',
  'which', 'whereis', 'type', 'env', 'printenv', 'df', 'du', 'free', 'ps', 'top',
  'ip', 'ss', 'netstat', 'ping', 'traceroute', 'dig', 'nslookup', 'curl', 'nmap', 'tshark',
]);

const CONFIRM_COMMANDS = new Set([
  'touch', 'mkdir', 'cp', 'mv', 'rm', 'rmdir', 'chmod', 'chown', 'ln', 'tee', 'truncate', 'dd',
  'apt', 'apt-get', 'pip', 'pip3', 'npm', 'kill', 'pkill', 'killall', 'systemctl', 'git',
]);

const DENIED_COMMANDS = new Set([
  'sudo', 'su', 'shutdown', 'reboot', 'poweroff', 'mount', 'umount', 'fdisk', 'mkfs', 'parted',
  'docker', 'kubectl', 'gcloud', 'aws', 'az', 'bash', 'sh', 'eval', 'exec', 'source', '.',
]);

const INTERNAL_HOSTS = new Set(['target', 'target2', 'target3', 'labtarget', 'localhost', '127.0.0.1', '::1', 'kali']);
const OPERATORS = new Set([';', '&&', '||', '|', '>', '>>', '<', '1>', '1>>', '2>', '2>>']);
const REDIRECTS = new Set(['>', '>>', '<', '1>', '1>>', '2>', '2>>']);

function denied(reason, parsedCommands = []) {
  return { classification: CommandClassification.DENIED, reason, parsedCommands, plan: null };
}

function tokenize(command) {
  const tokens = [];
  let value = '';
  let quote = '';
  const pushValue = () => {
    if (value) tokens.push(value);
    value = '';
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    const next = command[index + 1] ?? '';
    if (quote) {
      if (character === quote) {
        quote = '';
      } else if (character === '\\' && quote === '"' && next) {
        value += next;
        index += 1;
      } else {
        value += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      pushValue();
      continue;
    }
    if (character === '&') {
      pushValue();
      if (next !== '&') throw new Error('background execution is not supported');
      tokens.push('&&');
      index += 1;
      continue;
    }
    if (character === '|') {
      pushValue();
      if (next === '|') {
        tokens.push('||');
        index += 1;
      } else {
        tokens.push('|');
      }
      continue;
    }
    if (character === ';') {
      pushValue();
      tokens.push(';');
      continue;
    }
    if (character === '<') {
      pushValue();
      tokens.push('<');
      continue;
    }
    if (character === '>') {
      const descriptor = value === '1' || value === '2' ? value : '';
      if (descriptor) value = '';
      else pushValue();
      const append = next === '>';
      tokens.push(`${descriptor}>${append ? '>' : ''}`);
      if (append) index += 1;
      continue;
    }
    if (character === '\\' && next) {
      value += next;
      index += 1;
      continue;
    }
    value += character;
  }
  if (quote) throw new Error('unterminated quote');
  pushValue();
  return tokens;
}

function parsePlan(tokens) {
  const sequence = [];
  let pipeline = [];
  let argv = [];
  let redirects = [];
  let connector = null;

  const finishCommand = () => {
    if (!argv.length) throw new Error('operator without a command');
    pipeline.push({ argv, redirects });
    argv = [];
    redirects = [];
  };
  const finishPipeline = (nextConnector = null) => {
    finishCommand();
    sequence.push({ connector, pipeline });
    connector = nextConnector;
    pipeline = [];
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (REDIRECTS.has(token)) {
      const target = tokens[index + 1];
      if (!target || OPERATORS.has(target)) throw new Error('redirection target is missing');
      redirects.push({ operator: token, target });
      index += 1;
    } else if (token === '|') {
      finishCommand();
    } else if (token === ';' || token === '&&' || token === '||') {
      finishPipeline(token);
    } else {
      argv.push(token);
    }
  }
  finishPipeline();
  return { sequence };
}

function basename(value) {
  return value.split('/').filter(Boolean).at(-1) ?? value;
}

function internalHostname(value) {
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? new URL(value).hostname : value;
    return INTERNAL_HOSTS.has(candidate.toLowerCase());
  } catch {
    return false;
  }
}

function networkDestination(command, args) {
  if (command === 'curl') {
    return args.filter((argument) => /^[a-z][a-z0-9+.-]*:\/\//i.test(argument));
  }
  if (['ping', 'traceroute', 'dig', 'nslookup'].includes(command)) {
    return args.filter((argument) => !argument.startsWith('-')).slice(-1);
  }
  if (command === 'nmap') {
    const destinations = [];
    const optionsWithValue = new Set(['-p', '--ports', '--top-ports', '--host-timeout', '--max-retries', '--min-rate', '--max-rate', '--source-port']);
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index];
      if (optionsWithValue.has(argument)) {
        index += 1;
      } else if (!argument.startsWith('-')) {
        destinations.push(argument);
      }
    }
    return destinations;
  }
  return [];
}

function isSafeSedScript(script) {
  const source = script.trim();
  const address = String.raw`(?:(?:\d+|\$|\/(?:\\.|[^/])*\/)(?:,(?:\d+|\$|\/(?:\\.|[^/])*\/))?)?`;
  if (new RegExp(`^${address}\\s*[pdq=]\\s*$`).test(source)) return true;
  const match = source.match(new RegExp(`^${address}\\s*s([^\\w\\s\\\\])`));
  if (!match) return false;
  const delimiter = match[1];
  let index = match[0].length;
  let separators = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === delimiter) {
      separators += 1;
      if (separators === 2) break;
    }
  }
  if (separators !== 2) return false;
  return /^[gipIM0-9]*$/.test(source.slice(index + 1).trim());
}

function validateSed(args) {
  const scripts = [];
  let positionalScriptSeen = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (['-n', '--quiet', '--silent', '-E', '-r', '--regexp-extended', '-i', '--in-place', '--'].includes(argument)
      || /^-i.+/.test(argument) || argument.startsWith('--in-place=')) continue;
    if (argument === '-f' || argument === '--file' || argument.startsWith('--file=')) {
      return 'sed script files are prohibited';
    }
    if (argument === '-e' || argument === '--expression') {
      if (!args[index + 1]) return 'sed expression is missing';
      scripts.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (argument.startsWith('--expression=')) {
      scripts.push(argument.slice('--expression='.length));
      continue;
    }
    if (argument.startsWith('-') && !positionalScriptSeen) return 'unsupported sed option';
    if (!positionalScriptSeen && scripts.length === 0) {
      scripts.push(argument);
      positionalScriptSeen = true;
    }
  }
  if (!scripts.length || scripts.some((script) => !isSafeSedScript(script))) {
    return 'sed is limited to non-executing print, delete, quit, and substitution expressions';
  }
  return null;
}

function classifySimpleCommand(parsed) {
  const [rawCommand, ...args] = parsed.argv;
  const command = basename(rawCommand).toLowerCase();
  if (rawCommand.includes('/')) return denied('executable paths are prohibited; use an allowlisted command name');
  if (DENIED_COMMANDS.has(command)) return denied(`${command} is prohibited`);
  if (!READ_ONLY_COMMANDS.has(command) && !CONFIRM_COMMANDS.has(command)) return denied(`${command} is not in the Agent allowlist`);

  const destinations = networkDestination(command, args);
  if (destinations.some((destination) => !internalHostname(destination))) {
    return denied('network access is limited to TerminalBox internal hosts');
  }
  if (['curl', 'ping', 'traceroute', 'dig', 'nslookup', 'nmap'].includes(command) && destinations.length === 0) {
    return denied('an explicit TerminalBox internal destination is required');
  }

  if (command === 'find' && args.some((argument) => ['-exec', '-execdir', '-ok', '-okdir'].includes(argument))) {
    return denied('find command execution actions are prohibited');
  }
  if (command === 'sed') {
    const sedError = validateSed(args);
    if (sedError) return denied(sedError);
  }
  if (command === 'env' && args.length) return denied('env may only display the environment');
  if (command === 'nmap' && args.some((argument) => argument === '--script' || argument.startsWith('--script='))) {
    return denied('nmap scripts are not available to the Agent');
  }
  if (command === 'nmap' && args.some((argument) => ['-iL', '--input-file'].includes(argument) || argument.startsWith('--input-file='))) {
    return denied('nmap input files are prohibited');
  }
  if (command === 'rm' && args.some((argument) => ['/', '/home', '/home/student', '~'].includes(argument))) {
    return denied('broad filesystem deletion is prohibited');
  }
  if (command === 'ip' && args.includes('exec')) return denied('ip exec modes are prohibited');
  if (command === 'tshark' && args.some((argument) => argument === '-X' || argument.startsWith('-X'))) {
    return denied('tshark extension execution is prohibited');
  }

  let classification = READ_ONLY_COMMANDS.has(command)
    ? CommandClassification.READ_ONLY
    : CommandClassification.CONFIRM_REQUIRED;

  if (parsed.redirects.length) classification = CommandClassification.CONFIRM_REQUIRED;
  if (command === 'find' && args.some((argument) => ['-delete', '-fprint', '-fprint0', '-fprintf', '-fls'].includes(argument))) classification = CommandClassification.CONFIRM_REQUIRED;
  if (command === 'sed' && args.some((argument) => argument === '-i' || argument.startsWith('-i') || argument === '--in-place' || argument.startsWith('--in-place='))) classification = CommandClassification.CONFIRM_REQUIRED;
  if (command === 'curl' && args.some((argument) => [
    '-o', '--output', '-O', '--remote-name', '-T', '--upload-file', '-d', '--data', '--data-raw', '--data-binary', '-F', '--form',
    '--data-ascii', '--data-urlencode', '--json', '--form-string',
  ].includes(argument)
    || /^(--output|--upload-file|--data(?:-raw|-binary|-ascii|-urlencode)?|--json|--form(?:-string)?)=/.test(argument)
    || /^-(?:o|O|T|d|F).+/.test(argument))) {
    classification = CommandClassification.CONFIRM_REQUIRED;
  }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '-X' && !args[index].startsWith('-X') && args[index] !== '--request' && !args[index].startsWith('--request=')) continue;
    const method = args[index].startsWith('-X') && args[index] !== '-X'
      ? args[index].slice(2)
      : args[index].includes('=') ? args[index].split('=', 2)[1] : args[index + 1];
    if (!['GET', 'HEAD'].includes(String(method ?? '').toUpperCase())) classification = CommandClassification.CONFIRM_REQUIRED;
  }
  if (command === 'curl' && args.some((argument) => ['-K', '--config'].includes(argument) || argument.startsWith('--config='))) {
    return denied('curl configuration files are prohibited');
  }
  if (command === 'nmap' && args.some((argument) => /^-o[NXSGA]/.test(argument))) {
    classification = CommandClassification.CONFIRM_REQUIRED;
  }
  if (command === 'tshark' && args.some((argument) => argument === '-w' || argument.startsWith('-w'))) {
    classification = CommandClassification.CONFIRM_REQUIRED;
  }
  if (command === 'ip' && args.some((argument) => ['add', 'del', 'delete', 'replace', 'change', 'flush', 'set'].includes(argument))) {
    classification = CommandClassification.CONFIRM_REQUIRED;
  }
  if (command === 'git') {
    if (args.some((argument) => argument === '-c' || /^-c.+/.test(argument) || argument.startsWith('--exec-path') || argument.startsWith('--config-env'))) {
      return denied('git execution overrides are prohibited');
    }
    if (args.some((argument) => argument === '--ext-diff' || argument === '--textconv')) {
      return denied('git external diff and text conversion are prohibited');
    }
    const subcommand = args.find((argument) => !argument.startsWith('-')) ?? '';
    const subcommandIndex = args.indexOf(subcommand);
    const remaining = args.slice(subcommandIndex + 1);
    const branchReadOnly = subcommand === 'branch' && remaining.every((argument) => !/^-?[dDmMcC]$/.test(argument) && !/^(--delete|--move|--copy|--edit-description)$/.test(argument) && argument.startsWith('-'));
    const remoteReadOnly = subcommand === 'remote' && remaining.every((argument) => argument === '-v' || argument === '--verbose');
    classification = ['status', 'log', 'diff', 'show'].includes(subcommand) || branchReadOnly || remoteReadOnly
      ? CommandClassification.READ_ONLY : CommandClassification.CONFIRM_REQUIRED;
  }
  if (command === 'systemctl' && args[0] === 'status') classification = CommandClassification.READ_ONLY;
  if (['npm', 'pip', 'pip3'].includes(command)) {
    const allowedActions = command === 'npm'
      ? ['install', 'i', 'ci', 'uninstall', 'update']
      : ['install', 'uninstall'];
    if (!allowedActions.includes(args[0])) return denied(`${command} is limited to package changes that require approval`);
  }
  return { classification, command };
}

export function classifyCommand(value) {
  if (typeof value !== 'string') return denied('command must be a string');
  const command = value.trim();
  if (!command || command.length > 2000) return denied('command length is invalid');
  if (/\r|\n|\0/.test(command)) return denied('multiline commands are prohibited');
  if (/\$\(|`|<\(|>\(|\$\{|\x00/.test(command)) return denied('command substitution and expansion are prohibited');

  let plan;
  try {
    plan = parsePlan(tokenize(command));
  } catch (error) {
    return denied(`command syntax is not supported: ${error.message}`);
  }

  const parsedCommands = plan.sequence.flatMap((entry) => entry.pipeline.map((item) => item.argv));
  let classification = CommandClassification.READ_ONLY;
  for (const entry of plan.sequence) {
    for (const parsed of entry.pipeline) {
      const result = classifySimpleCommand(parsed);
      if (result.classification === CommandClassification.DENIED) return denied(result.reason, parsedCommands);
      if (result.classification === CommandClassification.CONFIRM_REQUIRED) classification = result.classification;
    }
  }
  return {
    classification,
    reason: classification === CommandClassification.READ_ONLY
      ? '閲覧・確認のみの許可済みコマンドです。'
      : 'ファイル、設定、プロセスなどを変更する可能性があります。',
    parsedCommands,
    plan,
  };
}
