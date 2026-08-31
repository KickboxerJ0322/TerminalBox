import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readRepositoryFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Cloud Lab keeps port 8080 available for the Burp proxy', async () => {
  const [nginxConfig, labDockerfile, cloudBuild, challengePanel] = await Promise.all([
    readRepositoryFile('cloud/nginx-lab.conf'),
    readRepositoryFile('Dockerfile.lab.cloud'),
    readRepositoryFile('cloudbuild.yaml'),
    readRepositoryFile('web/src/ChallengePanel.tsx'),
  ]);

  assert.match(nginxConfig, /listen 8081;/);
  assert.doesNotMatch(nginxConfig, /listen 8080;/);
  assert.match(labDockerfile, /EXPOSE 8081/);
  assert.match(labDockerfile, /terminalbox-agent-executor/);
  assert.match(nginxConfig, /location = \/internal\/agent\/execute/);
  assert.match(cloudBuild, /- \$\{_LAB_SERVICE\}[\s\S]*?- --port=8081/);
  assert.match(challengePanel, /HTTP Proxyを127\.0\.0\.1、Portを8080/);
});
