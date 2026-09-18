$ErrorActionPreference = 'Stop'

function Base64Url([byte[]]$bytes) {
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

Write-Host ''
Write-Host 'Crystal Spotify - Switch login setup' -ForegroundColor Green
Write-Host '------------------------------------'
Write-Host 'Before continuing, create a Spotify Developer app and add this exact Redirect URI:'
Write-Host 'http://127.0.0.1:43821/callback/' -ForegroundColor Yellow
Write-Host ''

$clientId = (Read-Host 'Paste your Spotify Client ID').Trim()
if ([string]::IsNullOrWhiteSpace($clientId)) { throw 'Client ID cannot be empty.' }

$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$random = New-Object byte[] 64
$rng.GetBytes($random)
$rng.Dispose()
$verifier = Base64Url $random

$sha = [System.Security.Cryptography.SHA256]::Create()
$challenge = Base64Url ($sha.ComputeHash([Text.Encoding]::ASCII.GetBytes($verifier)))
$sha.Dispose()

$stateBytes = New-Object byte[] 24
$rng2 = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$rng2.GetBytes($stateBytes)
$rng2.Dispose()
$state = Base64Url $stateBytes

$redirectUri = 'http://127.0.0.1:43821/callback/'
$scope = 'user-read-playback-state user-read-currently-playing user-modify-playback-state'

$authUrl = 'https://accounts.spotify.com/authorize?' +
    'client_id=' + [uri]::EscapeDataString($clientId) +
    '&response_type=code' +
    '&redirect_uri=' + [uri]::EscapeDataString($redirectUri) +
    '&scope=' + [uri]::EscapeDataString($scope) +
    '&code_challenge_method=S256' +
    '&code_challenge=' + [uri]::EscapeDataString($challenge) +
    '&state=' + [uri]::EscapeDataString($state)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($redirectUri)
$listener.Start()

Write-Host ''
Write-Host 'Opening Spotify login in your browser...' -ForegroundColor Cyan
Start-Process $authUrl

$context = $listener.GetContext()
$request = $context.Request
$response = $context.Response

Add-Type -AssemblyName System.Web
$query = [System.Web.HttpUtility]::ParseQueryString($request.Url.Query)
$code = $query['code']
$returnedState = $query['state']
$errorCode = $query['error']

$html = '<html><body style="background:#101010;color:#fff;font-family:Segoe UI;padding:40px"><h1>Crystal Spotify</h1><p>Login received. You can close this tab and go back to the setup window.</p></body></html>'
$bytes = [Text.Encoding]::UTF8.GetBytes($html)
$response.ContentType = 'text/html; charset=utf-8'
$response.ContentLength64 = $bytes.Length
$response.OutputStream.Write($bytes, 0, $bytes.Length)
$response.OutputStream.Close()
$listener.Stop()

if ($errorCode) { throw "Spotify login error: $errorCode" }
if (!$code) { throw 'Spotify did not return an authorization code.' }
if ($returnedState -ne $state) { throw 'OAuth state did not match. Please run setup again.' }

Write-Host 'Getting refresh token...' -ForegroundColor Cyan
$token = Invoke-RestMethod -Method Post -Uri 'https://accounts.spotify.com/api/token' `
    -ContentType 'application/x-www-form-urlencoded' `
    -Body @{
        grant_type = 'authorization_code'
        code = $code
        redirect_uri = $redirectUri
        client_id = $clientId
        code_verifier = $verifier
    }

if (!$token.refresh_token) { throw 'Spotify did not return a refresh token.' }

$outPath = Join-Path $PSScriptRoot 'spotify.cfg'
@(
    "client_id=$clientId"
    "refresh_token=$($token.refresh_token)"
) | Set-Content -Encoding ASCII $outPath

Write-Host ''
Write-Host 'SUCCESS!' -ForegroundColor Green
Write-Host "Created: $outPath"
Write-Host ''
Write-Host 'Copy spotify.cfg to:' -ForegroundColor Yellow
Write-Host 'SD:/switch/CrystalSpotify/spotify.cfg'
Write-Host ''
