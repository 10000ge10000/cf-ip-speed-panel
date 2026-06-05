# Windows 任务计划示例

## 1. 准备环境变量

在 PowerShell 中按实际值设置：

```powershell
[Environment]::SetEnvironmentVariable("WORKER_URL", "https://your-worker.workers.dev", "User")
[Environment]::SetEnvironmentVariable("UPLOAD_TOKEN", "replace-with-token", "User")
[Environment]::SetEnvironmentVariable("CARRIER", "ct", "User")
[Environment]::SetEnvironmentVariable("REGION", "陕西西安", "User")
[Environment]::SetEnvironmentVariable("SOURCE", "xian-windows", "User")
```

重新打开 PowerShell 后验证：

```powershell
$env:WORKER_URL
$env:UPLOAD_TOKEN
```

## 2. 创建任务计划

假设项目目录为：

```text
C:\tools\cf-ip-speed-panel
```

任务计划程序中填写：

- 程序：`powershell.exe`
- 参数：

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\tools\cf-ip-speed-panel\scripts\upload-windows.ps1"
```

- 起始于：

```text
C:\tools\cf-ip-speed-panel
```

建议触发器设置为每 6 小时执行一次。第一次运行建议手动执行脚本，确认 `cfst`、`result.csv` 和上传 Token 都正常。
