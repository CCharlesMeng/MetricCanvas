$ErrorActionPreference = 'Stop'

$hostname = 'local.ulanqab.huawei.com'
$friendlyName = 'MetricCanvas local Ulanqab HTTPS'
$appRoot = Split-Path -Parent $PSScriptRoot
$tlsDirectory = Join-Path $appRoot '.local-tls'
$pfxPath = Join-Path $tlsDirectory "$hostname.pfx"
$cerPath = Join-Path $tlsDirectory "$hostname.cer"
$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw '请以管理员身份运行此脚本；它需要写入 hosts 文件。'
}

New-Item -ItemType Directory -Path $tlsDirectory -Force | Out-Null

if (-not (Select-String -Path $hostsPath -Pattern "(^|\s)$([regex]::Escape($hostname))(\s|$)" -Quiet)) {
  Add-Content -Path $hostsPath -Value "127.0.0.1 $hostname" -Encoding Ascii
}

$certificate = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.FriendlyName -eq $friendlyName -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if ($null -eq $certificate) {
  $certificate = New-SelfSignedCertificate `
    -DnsName $hostname `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -FriendlyName $friendlyName `
    -Type SSLServerAuthentication `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -NotAfter (Get-Date).AddDays(825)
}

$emptyPassword = ConvertTo-SecureString -String '' -AsPlainText -Force
Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $emptyPassword -Force | Out-Null
Export-Certificate -Cert $certificate -FilePath $cerPath -Force | Out-Null

$trusted = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $certificate.Thumbprint }
if ($null -eq $trusted) {
  Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
}

Write-Output "已配置 https://$hostname:443。证书仅为该主机签发，并仅安装到当前用户证书库。"
