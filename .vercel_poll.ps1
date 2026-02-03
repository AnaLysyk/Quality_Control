$id='dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u'
$i=0
while ($i -lt 15) {
  $out = npx vercel inspect $id 2>&1
  Write-Host "--- poll $i ---"
  Write-Host $out
  if ($out -match 'status.*Ready') {
    Write-Host '=== READY - fetching logs ==='
    npx vercel logs $id
    exit 0
  }
  Start-Sleep -Seconds 10
  $i = $i + 1
}
Write-Host 'Timed out waiting for deployment readiness'
exit 2
