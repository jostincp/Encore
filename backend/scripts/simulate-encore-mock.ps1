# Simulación Encore con Mock Data (PowerShell)
# Este script imprime las requests y respuestas mock del flujo completo.
# Por defecto NO realiza llamadas HTTP reales.

param(
    [string]$AuthBase = "http://localhost:3001/api",
    [string]$MenuBase = "http://localhost:3002/api",
    [string]$MusicBase = "http://localhost:3003/api/music",
    [string]$QueueBase = "http://localhost:3005/api",
    [string]$PointsBase = "http://localhost:3004/api",
  [string]$DryRun = 'true'
)

# Normalizar el parámetro DryRun a booleano de forma robusta (PowerShell 5)
$isDryRun = $true
$DryRunParam = $DryRun
if ($null -eq $DryRunParam) { $DryRunParam = 'true' }
$val = ($DryRunParam).ToString().ToLower()
switch ($val) {
  'false' { $isDryRun = $false }
  '0' { $isDryRun = $false }
  'no' { $isDryRun = $false }
  'true' { $isDryRun = $true }
  '1' { $isDryRun = $true }
  'yes' { $isDryRun = $true }
  default { $isDryRun = $true }
}

function Show-Step {
  param([string]$Title)
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Mock-Response {
  param([hashtable]$Body)
  $json = $Body | ConvertTo-Json -Depth 6
  Write-Host $json -ForegroundColor Green
}

function Send-Request {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  Write-Host "Request: $Method $Url" -ForegroundColor Yellow
  if ($Headers.Count -gt 0) { Write-Host "Headers: $(($Headers | ConvertTo-Json))" -ForegroundColor Yellow }
  if ($Body) { Write-Host "Body: $(($Body | ConvertTo-Json -Depth 6))" -ForegroundColor Yellow }

  if ($isDryRun) {
    return $null
  } else {
    $invokeParams = @{ Method = $Method; Uri = $Url; Headers = $Headers }
    if ($Body) { $invokeParams["Body"] = ($Body | ConvertTo-Json -Depth 6); $invokeParams["ContentType"] = "application/json" }
    try {
      # Use Invoke-WebRequest to capture status code and raw content
      $resp = Invoke-WebRequest @invokeParams -UseBasicParsing
      Write-Host ("Status: {0}" -f $resp.StatusCode) -ForegroundColor Cyan
      if ($resp.Content) {
        try {
          $parsed = $resp.Content | ConvertFrom-Json
          Write-Host ($parsed | ConvertTo-Json -Depth 8) -ForegroundColor Green
        } catch {
          Write-Host $resp.Content -ForegroundColor Green
        }
      }
      return $resp
    } catch {
      Write-Warning ("Error: {0}" -f $_.Exception.Message)
      if ($_.ErrorDetails.Message) { Write-Warning ("Details: {0}" -f $_.ErrorDetails.Message) }
      return $null
    }
  }
}

# IDs y tokens mock
$barId = "123e4567-e89b-12d3-a456-426614174000"
$songId = "321e4567-e89b-12d3-a456-426614174111"
$categoryId = "789e4567-e89b-12d3-a456-426614174999"
$userId = "456e4567-e89b-12d3-a456-426614174222"
$ownerAccessToken = "mock_access_token_bar_owner"
$guestAccessToken = "mock_access_token_guest"
$memberAccessToken = "mock_access_token_user"

# 1) Registro Bar Owner
Show-Step "Registro de Negocio (Bar Owner)"
$registerOwnerUrl = "$AuthBase/auth/register-bar-owner"
$registerOwnerBody = @{ email = "owner@example.com"; password = "Password123!"; nombre_del_bar = "Bar Encore" }
${null} = Send-Request -Method POST -Url $registerOwnerUrl -Body $registerOwnerBody
if ($isDryRun) { Mock-Response @{ success = $true; user = @{ id = "aa0b..."; email = "owner@example.com"; role = "bar_owner"; isActive = $true }; bar = @{ id = $barId; name = "Bar Encore" }; accessToken = $ownerAccessToken; refreshToken = "mock_refresh_token_bar_owner" } }

# 2) Login Bar Owner
Show-Step "Login del Negocio"
$loginUrl = "$AuthBase/auth/login"
$loginBody = @{ email = "owner@example.com"; password = "Password123!" }
${null} = Send-Request -Method POST -Url $loginUrl -Body $loginBody
if ($isDryRun) { Mock-Response @{ success = $true; accessToken = $ownerAccessToken; refreshToken = "mock_refresh_token_bar_owner" } }

# 3) Crear categoría y menú
Show-Step "Creación de Categoría"
$createCategoryUrl = "$MenuBase/bars/$barId/categories"
${null} = Send-Request -Method POST -Url $createCategoryUrl -Headers @{ Authorization = "Bearer $ownerAccessToken" } -Body @{ name = "Bebidas"; description = "Refrescos y cócteles"; is_active = $true }
if ($isDryRun) { Mock-Response @{ success = $true; data = @{ id = $categoryId; name = "Bebidas" } } }

Show-Step "Creación de Item de Menú"
$createItemUrl = "$MenuBase/bars/$barId/menu"
$itemBody = @{ name = "Mojito"; description = "Clásico con hierbabuena"; price = 8.5; category_id = $categoryId; tags = @("popular","cocktail"); is_available = $true }
${null} = Send-Request -Method POST -Url $createItemUrl -Headers @{ Authorization = "Bearer $ownerAccessToken" } -Body $itemBody
if ($isDryRun) { Mock-Response @{ success = $true; data = @{ id = "item-001"; name = "Mojito"; is_available = $true } } }

# 4) Música inicial (búsqueda)
Show-Step "Búsqueda de Música"
$searchUrl = "$MusicBase/songs/search?q=queen&barId=$barId&limit=5"
${null} = Send-Request -Method GET -Url $searchUrl -Headers @{ Authorization = "Bearer $ownerAccessToken" }
if ($isDryRun) { Mock-Response @{ success = $true; data = @(@{ id = $songId; title = "Bohemian Rhapsody"; artist = "Queen"; source = "spotify" }) } }

# 5) Registro de Cliente (Guest)
Show-Step "Registro Cliente Invitado"
$registerGuestUrl = "$AuthBase/auth/register-guest"
${null} = Send-Request -Method POST -Url $registerGuestUrl
if ($isDryRun) { Mock-Response @{ success = $true; user = @{ id = $userId; role = "guest"; isGuest = $true }; accessToken = $guestAccessToken } }

# 6) Upgrade a Miembro
Show-Step "Cliente pasa a Miembro"
$registerMemberUrl = "$AuthBase/auth/register-user"
$memberBody = @{ email = "client@example.com"; password = "Password123!"; firstName = "Ana"; lastName = "Pérez" }
${null} = Send-Request -Method POST -Url $registerMemberUrl -Headers @{ Authorization = "Bearer $guestAccessToken" } -Body $memberBody
if ($isDryRun) { Mock-Response @{ success = $true; user = @{ id = $userId; email = "client@example.com"; role = "user" }; accessToken = $memberAccessToken; refreshToken = "mock_refresh_token_user" } }

# 7) Explorar Menú
Show-Step "Cliente explora el Menú"
$getMenuUrl = "$MenuBase/bars/$barId/menu?is_available=true"
${null} = Send-Request -Method GET -Url $getMenuUrl
if ($isDryRun) { Mock-Response @{ success = $true; data = @(@{ id = "item-001"; name = "Mojito"; price = 8.5 }) } }

# 8) Solicitar Canción
Show-Step "Cliente pide una canción"
$addQueueUrl = "$MusicBase/queue/$barId/add"
$addQueueBody = @{ song_id = $songId; priority_play = $false; notes = "Para celebrar" }
${null} = Send-Request -Method POST -Url $addQueueUrl -Headers @{ Authorization = "Bearer $memberAccessToken" } -Body $addQueueBody
if ($isDryRun) { Mock-Response @{ success = $true; data = @{ id = "queue-001"; status = "pending"; song_id = $songId } } }

# 9) Gestión de Cola
Show-Step "Ver Cola"
$getQueueUrl = "$MusicBase/queue/$barId?status=pending,playing&include_details=true"
${null} = Send-Request -Method GET -Url $getQueueUrl
if ($isDryRun) { Mock-Response @{ success = $true; data = @(@{ id = "queue-001"; status = "pending"; song_id = $songId }) } }

Show-Step "Canción Actual"
$currentUrl = "$MusicBase/queue/$barId/current"
${null} = Send-Request -Method GET -Url $currentUrl
if ($isDryRun) { Mock-Response @{ success = $true; data = @{ id = "queue-000"; status = "playing"; song_id = "prev-song" } } }

Show-Step "Reordenar Cola (Owner)"
$reorderUrl = "$MusicBase/queue/bars/$barId/reorder"
${null} = Send-Request -Method PATCH -Url $reorderUrl -Headers @{ Authorization = "Bearer $ownerAccessToken" } -Body @{ queue_ids = @("queue-001") }
if ($isDryRun) { Mock-Response @{ success = $true } }

# 10) Sistema de Puntos
Show-Step "Consultar Balance de Puntos"
$balanceUrl = "$PointsBase/points/bars/$barId/balance"
${null} = Send-Request -Method GET -Url $balanceUrl -Headers @{ Authorization = "Bearer $memberAccessToken" }
if ($isDryRun) { Mock-Response @{ success = $true; data = @{ user_id = $userId; bar_id = $barId; balance = 150; total_earned = 500; total_spent = 350 } } }

Show-Step "Añadir Puntos (Admin/Owner)"
$addPointsUrl = "$PointsBase/points/transaction"
$txnBody = @{ user_id = $userId; bar_id = $barId; type = "earn"; amount = 50; description = "Compra de bebida" }
${null} = Send-Request -Method POST -Url $addPointsUrl -Headers @{ Authorization = "Bearer $ownerAccessToken" } -Body $txnBody
if ($isDryRun) { Mock-Response @{ success = $true; data = @{ transaction = @{ id = "txn-001"; type = "earn"; amount = 50 }; balance = @{ balance = 150 } } } }

Show-Step "Simulación completa finalizada"
Write-Host "Si deseas ejecutar contra servicios reales, llama el script con -DryRun:$false" -ForegroundColor Cyan