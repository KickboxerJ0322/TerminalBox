$ErrorActionPreference = 'Stop'

$ProjectId = if ($env:GOOGLE_CLOUD_PROJECT) { $env:GOOGLE_CLOUD_PROJECT } else { 'jumpeicloud' }
$Region = if ($env:TERMINALBOX_REGION) { $env:TERMINALBOX_REGION } else { 'asia-northeast1' }
$Network = 'terminalbox-vpc'
$Subnet = 'terminalbox-run'
$WebServiceAccount = "terminalbox-web-runtime@$ProjectId.iam.gserviceaccount.com"
$LabServiceAccount = "terminalbox-lab-runtime@$ProjectId.iam.gserviceaccount.com"

gcloud config set project $ProjectId | Out-Null
gcloud services enable run.googleapis.com compute.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

$ServiceAccounts = @(gcloud iam service-accounts list --format='value(email)')
if ($WebServiceAccount -notin $ServiceAccounts) {
  gcloud iam service-accounts create terminalbox-web-runtime --display-name='TerminalBox Web runtime'
}
if ($LabServiceAccount -notin $ServiceAccounts) {
  gcloud iam service-accounts create terminalbox-lab-runtime --display-name='TerminalBox Lab runtime (no project roles)'
}

gcloud secrets add-iam-policy-binding GEMINI_API_KEY --member="serviceAccount:$WebServiceAccount" --role=roles/secretmanager.secretAccessor | Out-Null
gcloud secrets add-iam-policy-binding terminalbox-access-password --member="serviceAccount:$WebServiceAccount" --role=roles/secretmanager.secretAccessor | Out-Null

$Networks = @(gcloud compute networks list --format='value(name)')
if ($Network -notin $Networks) {
  gcloud compute networks create $Network --subnet-mode=custom
}
$Subnets = @(gcloud compute networks subnets list --regions=$Region --format='value(name)')
if ($Subnet -notin $Subnets) {
  gcloud compute networks subnets create $Subnet --network=$Network --region=$Region --range=10.42.0.0/26 --enable-private-ip-google-access
} else {
  gcloud compute networks subnets update $Subnet --region=$Region --enable-private-ip-google-access
}

$FirewallRules = @(gcloud compute firewall-rules list --format='value(name)')
if ('terminalbox-lab-deny-all-egress' -notin $FirewallRules) {
  gcloud compute firewall-rules create terminalbox-lab-deny-all-egress `
    --network=$Network --direction=EGRESS --priority=100 --action=DENY --rules=all `
    --destination-ranges=0.0.0.0/0 --target-tags=terminalbox-lab-deny-egress --enable-logging
}

$Routers = @(gcloud compute routers list --regions=$Region --format='value(name)')
if ('terminalbox-router' -notin $Routers) {
  gcloud compute routers create terminalbox-router --network=$Network --region=$Region
}
$Nats = @(gcloud compute routers nats list --router=terminalbox-router --region=$Region --format='value(name)')
if ('terminalbox-web-nat' -notin $Nats) {
  gcloud compute routers nats create terminalbox-web-nat --router=terminalbox-router --region=$Region `
    --nat-all-subnet-ip-ranges --auto-allocate-nat-external-ips
}

Write-Host 'TerminalBox Web/Lab infrastructure is ready.'
Write-Host "Web runtime: $WebServiceAccount"
Write-Host "Lab runtime: $LabServiceAccount (no project-level roles)"
