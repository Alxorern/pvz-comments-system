# Simple copy backup script (no compression)
param(
    [string]$SourcePath = "",
    [string]$BackupPath = "C:\Backups"
)

function Create-CopyBackup {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    try {
        Write-Host "Starting copy backup process..." -ForegroundColor Yellow
        
        # Create Backups folder if it doesn't exist
        if (!(Test-Path $BackupPath)) {
            New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
            Write-Host "Created folder: $BackupPath" -ForegroundColor Green
        }
        
        # Get folder name for backup
        $FolderName = Split-Path $Source -Leaf
        $Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
        $BackupName = "${FolderName}_${Timestamp}"
        $FullBackupPath = Join-Path $BackupPath $BackupName
        
        Write-Host "Source: $Source" -ForegroundColor Cyan
        Write-Host "Backup: $FullBackupPath" -ForegroundColor Cyan
        
        # Remove existing backup if it exists
        if (Test-Path $FullBackupPath) {
            Remove-Item $FullBackupPath -Recurse -Force
        }
        
        # Get source folder size
        $SourceSize = (Get-ChildItem -Path $Source -Recurse -File | Measure-Object -Property Length -Sum).Sum
        $SourceSizeMB = [math]::Round($SourceSize / 1MB, 2)
        Write-Host "Source folder size: $SourceSizeMB MB" -ForegroundColor Cyan
        
        # Copy folder
        Write-Host "Copying files..." -ForegroundColor Yellow
        $StartTime = Get-Date
        
        # Use robocopy for reliable copying
        $RobocopyArgs = @(
            "`"$Source`"",
            "`"$FullBackupPath`"",
            "/E",           # Copy subdirectories including empty ones
            "/R:3",         # Retry 3 times
            "/W:1",         # Wait 1 second between retries
            "/NFL",         # No file list
            "/NDL",         # No directory list
            "/NJH",         # No job header
            "/NJS",         # No job summary
            "/NC",          # No class
            "/NS",          # No size
            "/NP"           # No progress
        )
        
        $RobocopyCommand = "robocopy " + ($RobocopyArgs -join " ")
        Write-Host "Running: $RobocopyCommand" -ForegroundColor Gray
        
        $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
        $ProcessInfo.FileName = "robocopy.exe"
        $ProcessInfo.Arguments = ($RobocopyArgs -join " ")
        $ProcessInfo.UseShellExecute = $false
        $ProcessInfo.CreateNoWindow = $true
        $ProcessInfo.RedirectStandardOutput = $true
        $ProcessInfo.RedirectStandardError = $true
        
        $Process = New-Object System.Diagnostics.Process
        $Process.StartInfo = $ProcessInfo
        
        $Process.Start() | Out-Null
        
        # Wait for process with timeout (30 minutes)
        $Timeout = 1800000 # 30 minutes in milliseconds
        $Completed = $Process.WaitForExit($Timeout)
        
        $EndTime = Get-Date
        $Duration = $EndTime - $StartTime
        
        if ($Completed) {
            # Robocopy exit codes: 0-7 are success, 8+ are errors
            if ($Process.ExitCode -le 7) {
                Write-Host "Copy completed successfully!" -ForegroundColor Green
                Write-Host "Duration: $($Duration.TotalSeconds.ToString('F1')) seconds" -ForegroundColor Cyan
            } else {
                $ErrorOutput = $Process.StandardError.ReadToEnd()
                throw "Copy failed with exit code $($Process.ExitCode): $ErrorOutput"
            }
        } else {
            $Process.Kill()
            throw "Copy timed out after 30 minutes"
        }
        
        # Validate backup
        if (Test-Path $FullBackupPath) {
            $BackupSize = (Get-ChildItem -Path $FullBackupPath -Recurse -File | Measure-Object -Property Length -Sum).Sum
            $BackupSizeMB = [math]::Round($BackupSize / 1MB, 2)
            
            Write-Host "Backup created successfully!" -ForegroundColor Green
            Write-Host "Backup name: $BackupName" -ForegroundColor White
            Write-Host "Backup size: $BackupSizeMB MB" -ForegroundColor White
            Write-Host "Source size: $SourceSizeMB MB" -ForegroundColor White
            Write-Host "Path: $FullBackupPath" -ForegroundColor White
            
            # Validate backup size
            if ([math]::Abs($BackupSize - $SourceSize) -lt ($SourceSize * 0.01)) {
                Write-Host "Backup size matches source (within 1%)" -ForegroundColor Green
            } else {
                Write-Host "WARNING: Backup size differs significantly from source!" -ForegroundColor Yellow
            }
            
        } else {
            throw "Backup was not created"
        }
        
    } catch {
        Write-Host "Error creating backup: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    return $true
}

# Main logic
Clear-Host
Write-Host "Copy Backup Script (No Compression)" -ForegroundColor Magenta
Write-Host "=" * 50 -ForegroundColor Magenta
Write-Host ""

if ($SourcePath -and (Test-Path $SourcePath)) {
    Write-Host "Using provided path: $SourcePath" -ForegroundColor Cyan
    $Success = Create-CopyBackup -Source $SourcePath -Destination $BackupPath
    if ($Success) {
        Write-Host "Backup completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Backup failed!" -ForegroundColor Red
    }
} else {
    Write-Host "Please provide a valid source path:" -ForegroundColor Yellow
    Write-Host "Example: .\backup-copy.ps1 -SourcePath 'C:\Google_sheets_app'" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
