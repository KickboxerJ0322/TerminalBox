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
  assert.match(nginxConfig, /location = \/internal\/challenges\/check-target-flag/);
  assert.match(cloudBuild, /- \$\{_LAB_SERVICE\}[\s\S]*?- --port=8081/);
  assert.match(challengePanel, /HTTP Proxyを127\.0\.0\.1、Portを8080/);
});

test('Cloud Run concurrency is high enough for noVNC parallel assets', async () => {
  const cloudBuild = await readRepositoryFile('cloudbuild.yaml');

  assert.match(cloudBuild, /--concurrency=80/);
  assert.match(cloudBuild, /--max-instances=1/);
});

test('Cloud Lab target routes go through the session-aware backend proxy', async () => {
  const nginxConfig = await readRepositoryFile('cloud/nginx-lab.conf');

  for (const route of ['/target-site/', '/target-site-2/', '/target-site-3/', '/target-site-4/', '/target-site-5/', '/tool-target/']) {
    const blockStart = nginxConfig.indexOf(`location ${route} {`);
    assert.notEqual(blockStart, -1, `${route} location exists`);
    const block = nginxConfig.slice(blockStart, nginxConfig.indexOf('\n  }', blockStart));
    assert.match(block, /proxy_pass http:\/\/127\.0\.0\.1:3001/);
    assert.doesNotMatch(block, /proxy_pass http:\/\/127\.0\.0\.[2-5]/);
  }
});

test('Cloud deployment isolates Kali egress and protects internal APIs', async () => {
  const [cloudBuild, infrastructure, startLab, terminalSource, executorSource] = await Promise.all([
    readRepositoryFile('cloudbuild.yaml'),
    readRepositoryFile('cloud/setup-infrastructure.ps1'),
    readRepositoryFile('cloud/start-lab.sh'),
    readRepositoryFile('backend/src/terminal.js'),
    readRepositoryFile('backend/src/agent/command-executor.js'),
  ]);

  assert.match(cloudBuild, /--network-tags=\$\{_LAB_NETWORK_TAG\}/);
  assert.match(cloudBuild, /--set-secrets=INTERNAL_API_TOKEN=terminalbox-internal-api-token:latest/);
  assert.match(cloudBuild, /INTERNAL_API_TOKEN=terminalbox-internal-api-token:latest/);
  assert.match(cloudBuild, /AGENT_SESSION_LIMIT=10/);
  assert.doesNotMatch(cloudBuild, /secrets\s+- add-iam-policy-binding\s+- terminalbox-internal-api-token/);
  assert.match(cloudBuild, /--service-account=\$\{_LAB_RUNTIME_SA\}@\$PROJECT_ID\.iam\.gserviceaccount\.com/);
  assert.match(cloudBuild, /--member=serviceAccount:\$\{_WEB_RUNTIME_SA\}@\$PROJECT_ID\.iam\.gserviceaccount\.com/);
  assert.match(cloudBuild, /MAX_AGENT_STEPS=15/);
  assert.match(infrastructure, /terminalbox-lab-deny-all-egress/);
  assert.match(infrastructure, /--destination-ranges=0\.0\.0\.0\/0/);
  assert.match(infrastructure, /terminalbox-internal-api-token/);
  assert.match(infrastructure, /gcloud secrets add-iam-policy-binding terminalbox-internal-api-token --member="serviceAccount:\$WebServiceAccount" --role=roles\/secretmanager\.secretAccessor/);
  assert.match(infrastructure, /gcloud secrets add-iam-policy-binding terminalbox-internal-api-token --member="serviceAccount:\$LabServiceAccount" --role=roles\/secretmanager\.secretAccessor/);
  assert.match(startLab, /SERVICE_ROLE=lab/);
  assert.doesNotMatch(startLab, /KALI_EXEC_MODE|AI_PROVIDER/);
  assert.doesNotMatch(terminalSource, /dockerode|docker\.sock|getContainer/);
  assert.doesNotMatch(executorSource, /dockerode|docker\.sock|getContainer/);
});
