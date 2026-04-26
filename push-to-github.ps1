# رفع المشروع إلى GitHub — شغّل هذا الملف من PowerShell بعد تثبيت Git.
# المستودع: https://github.com/samar-ux/GenoAI.git
# إذا طُلب منك اسم مستخدم/كلمة مرور: استخدم Personal Access Token بدل كلمة المرور.
# إنشاء Token: GitHub → Settings → Developer settings → Personal access tokens

$ErrorActionPreference = "Stop"
$RemoteUrl = "https://github.com/samar-ux/GenoAI.git"

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host ""
    Write-Host "Git غير مثبت أو غير موجود في PATH." -ForegroundColor Yellow
    Write-Host "حمّل المثبّت من: https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "بعد التثبيت: أغلق وأعد فتح PowerShell أو Cursor، ثم شغّل هذا السكربت مجدداً." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Set-Location $PSScriptRoot

if (-not (Test-Path ".git")) {
    git init
}

git add .

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "لا توجد تغييرات جديدة للرفع (كل شيء مُلتقط بالفعل)." -ForegroundColor Yellow
} else {
    git commit -m "Initial commit: Geno AI"
}

git branch -M main 2>$null

$hasOrigin = git remote 2>$null | Select-String -Pattern "^origin$"
if ($hasOrigin) {
    git remote set-url origin $RemoteUrl
} else {
    git remote add origin $RemoteUrl
}

Write-Host ""
Write-Host "جاري الدفع إلى origin/main..." -ForegroundColor Cyan
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "تم الرفع بنجاح: $RemoteUrl" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "فشل الدفع. تأكد من تسجيل الدخول إلى GitHub (Token أو GitHub Desktop)." -ForegroundColor Red
    exit $LASTEXITCODE
}
