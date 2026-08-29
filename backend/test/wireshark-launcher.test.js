import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readRepositoryFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Wireshark uses the noVNC-safe launcher in every Kali image', async () => {
  const [launcher, activator, localDockerfile, cloudDockerfile, labDockerfile] = await Promise.all([
    readRepositoryFile('kali/wireshark-launcher.sh'),
    readRepositoryFile('kali/activate-tool.sh'),
    readRepositoryFile('kali/Dockerfile'),
    readRepositoryFile('Dockerfile.cloud'),
    readRepositoryFile('Dockerfile.lab.cloud'),
  ]);

  assert.match(launcher, /DISPLAY="\$\{DISPLAY:-:1\}"/);
  assert.match(launcher, /XAUTHORITY=/);
  assert.match(launcher, /XDG_RUNTIME_DIR=/);
  assert.match(launcher, /exec \/usr\/bin\/wireshark "\$@"/);
  assert.match(activator, /wmctrl -xa/);
  assert.match(activator, /wmctrl -k on/);
  for (const dockerfile of [localDockerfile, cloudDockerfile, labDockerfile]) {
    assert.match(dockerfile, /wireshark-launcher\.sh \/usr\/local\/bin\/wireshark/);
    assert.match(dockerfile, /activate-tool\.sh \/usr\/local\/bin\/terminalbox-activate-tool/);
    assert.match(dockerfile, /\bwmctrl\b/);
  }
});
