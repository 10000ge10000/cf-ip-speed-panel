param(
    [string]$WorkerUrl = $env:WORKER_URL,
    [string]$UploadToken = $env:UPLOAD_TOKEN,
    [string]$Carrier = $(if ($env:CARRIER) { $env:CARRIER } else { "other" }),
    [string]$Region = $env:REGION,
    [string]$Source = $(if ($env:SOURCE) { $env:SOURCE } else { $env:COMPUTERNAME }),
    [string]$ResultFile = $(if ($env:RESULT_FILE) { $env:RESULT_FILE } else { "result.csv" }),
    [switch]$SkipCfst
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($WorkerUrl)) {
    throw "请设置 WORKER_URL，例如 https://cf-ip-speed-panel.xxx.workers.dev"
}

if ([string]::IsNullOrWhiteSpace($UploadToken)) {
    throw "请设置 UPLOAD_TOKEN，且必须与 Cloudflare Worker Secret 一致"
}

if (-not $SkipCfst) {
    $cfst = Get-Command cfst -ErrorAction SilentlyContinue
    if (-not $cfst) {
        throw "未找到 cfst 命令。请先安装 CloudflareSpeedTest/cfst，并确保 cfst 在 PATH 中。"
    }
    & cfst
}

if (-not (Test-Path -LiteralPath $ResultFile)) {
    throw "未找到 $ResultFile。请确认 cfst 已生成测速结果。"
}

function Get-RowValue {
    param(
        [object]$Row,
        [string[]]$Names,
        [string]$Default = ""
    )

    foreach ($name in $Names) {
        if ($Row.PSObject.Properties.Name -contains $name) {
            $value = [string]$Row.$name
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                return $value.Trim()
            }
        }
    }
    return $Default
}

function Convert-ToNumber {
    param(
        [string]$Value,
        [double]$Default = 0
    )

    $clean = $Value.Replace("MB/s", "").Replace("ms", "").Replace("%", "").Trim()
    $number = 0.0
    if ([double]::TryParse($clean, [ref]$number)) {
        return $number
    }
    return $Default
}

$rows = Import-Csv -LiteralPath $ResultFile
$nodes = foreach ($row in $rows) {
    $ip = Get-RowValue -Row $row -Names @("IP 地址", "IP", "ip")
    if ([string]::IsNullOrWhiteSpace($ip)) {
        continue
    }

    [ordered]@{
        ip = $ip
        port = [int](Convert-ToNumber -Value (Get-RowValue -Row $row -Names @("端口", "port") -Default "443") -Default 443)
        latency = Convert-ToNumber -Value (Get-RowValue -Row $row -Names @("平均延迟", "延迟", "latency", "Delay") -Default "0")
        speed = Convert-ToNumber -Value (Get-RowValue -Row $row -Names @("下载速度", "速度", "speed", "Download Speed") -Default "0")
        loss = Convert-ToNumber -Value (Get-RowValue -Row $row -Names @("丢包率", "loss", "Packet Loss") -Default "0")
        tls = $true
        colo = Get-RowValue -Row $row -Names @("数据中心", "colo", "Colo")
    }
}

$payload = [ordered]@{
    source = $Source
    region = $Region
    carrier = $Carrier
    nodes = @($nodes)
}

$json = $payload | ConvertTo-Json -Depth 8
$uploadUrl = $WorkerUrl.TrimEnd("/") + "/api/upload"

Invoke-RestMethod `
    -Uri $uploadUrl `
    -Method Post `
    -Headers @{ Authorization = "Bearer $UploadToken" } `
    -ContentType "application/json; charset=utf-8" `
    -Body $json

Write-Host "上传完成"
