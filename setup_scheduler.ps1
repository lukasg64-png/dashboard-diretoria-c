# setup_scheduler.ps1 — Registra a tarefa de atualização diária no Agendador de Tarefas do Windows
param (
    [string]$TaskName = "FSJ_Sync_Diretoria_C",
    [string]$Hour1 = "06:30",
    [string]$Hour2 = "13:00"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BatPath = Join-Path $ScriptDir "atualizar_diretoria_cintia.bat"

if (-not (Test-Path $BatPath)) {
    Write-Error "Arquivo atualizar_diretoria_cintia.bat nao encontrado em: $ScriptDir"
    exit 1
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AGENDAMENTO AUTOMATICO - DASHBOARD DIRETORIA CINTIA SILVA" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Bat Path: $BatPath"

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatPath`"" -WorkingDirectory $ScriptDir

$Trigger1 = New-ScheduledTaskTrigger -Daily -At $Hour1
$Trigger2 = New-ScheduledTaskTrigger -Daily -At $Hour2

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger @($Trigger1, $Trigger2) `
        -Settings $Settings `
        -Description "Atualizacao automatica do Dashboard da Diretoria C (Qlik Cloud SaaS + Metas + GitHub Pages)" `
        -Force | Out-Null

    Write-Host "Tarefa '$TaskName' agendada com sucesso para rodar diariamente as $Hour1 e $Hour2!" -ForegroundColor Green
} catch {
    $errMsg = $_.Exception.Message
    Write-Error "Falha ao registrar agendamento: $errMsg"
}
