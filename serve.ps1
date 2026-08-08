# PinDou local debug server
# Uses .NET HttpListener to serve static files, no Python/Node required
# Usage: powershell -ExecutionPolicy Bypass -File serve.ps1
# URL:   http://localhost:8080

$port = 8080
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
} catch {
    Write-Host "Failed to start server (port $port may be in use): $_" -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PinDou Debug Server Started" -ForegroundColor Green
Write-Host " URL:  http://localhost:$port" -ForegroundColor Yellow
Write-Host " Root: $root" -ForegroundColor Gray
Write-Host " Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Get-ContentType($filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    switch ($ext) {
        '.html' { return 'text/html; charset=utf-8' }
        '.htm'  { return 'text/html; charset=utf-8' }
        '.js'   { return 'application/javascript; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.gif'  { return 'image/gif' }
        '.svg'  { return 'image/svg+xml' }
        '.ico'  { return 'image/x-icon' }
        '.woff' { return 'font/woff' }
        '.woff2'{ return 'font/woff2' }
        default { return 'application/octet-stream' }
    }
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq '/' -or $urlPath -eq '') {
            $urlPath = '/index.html'
        }

        $relativePath = [System.Uri]::UnescapeDataString($urlPath.TrimStart('/'))
        $filePath = Join-Path $root $relativePath

        $statusColor = 'Green'
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = Get-ContentType $filePath
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $statusCode = 200
        } else {
            $response.StatusCode = 404
            $errorMsg = "404 - File Not Found: $urlPath"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($errorMsg)
            $response.ContentType = 'text/plain; charset=utf-8'
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $statusCode = 404
            $statusColor = 'Red'
        }

        $timestamp = Get-Date -Format 'HH:mm:ss'
        Write-Host "[$timestamp] $statusCode $($request.HttpMethod) $urlPath" -ForegroundColor $statusColor

        $response.Close()
    }
}
finally {
    if ($listener) {
        $listener.Stop()
        Write-Host "`nServer stopped." -ForegroundColor Yellow
    }
}
