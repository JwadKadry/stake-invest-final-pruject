# Test script for portfolio endpoints
# Run this after starting the server

Write-Host "Testing /api/investments/portfolio..." -ForegroundColor Cyan
try {
    $portfolio = Invoke-RestMethod "http://localhost:5000/api/investments/portfolio" -Method Get -Headers @{"Cookie"="connect.sid=test"} -ErrorAction Stop
    $portfolio | ConvertTo-Json -Depth 10 | Out-File "portfolio-test.json"
    
    Write-Host "✓ Portfolio endpoint responded" -ForegroundColor Green
    
    # Check summary
    if ($portfolio.summary) {
        Write-Host "  Summary found:" -ForegroundColor Yellow
        Write-Host "    totalUserInvested: $($portfolio.summary.totalUserInvested)"
        Write-Host "    totalInvestmentsCount: $($portfolio.summary.totalInvestmentsCount)"
        Write-Host "    uniquePropertiesCount: $($portfolio.summary.uniquePropertiesCount)"
        Write-Host "    avgInvestment: $($portfolio.summary.avgInvestment)"
        Write-Host "    topCity: $($portfolio.summary.topCity)"
        
        # Verify no division by zero
        if ([double]::IsInfinity($portfolio.summary.avgInvestment) -or [double]::IsNaN($portfolio.summary.avgInvestment)) {
            Write-Host "  ✗ ERROR: avgInvestment is Infinity or NaN!" -ForegroundColor Red
        } else {
            Write-Host "  ✓ avgInvestment is valid" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✗ ERROR: No summary in response!" -ForegroundColor Red
    }
    
    # Check data
    if ($portfolio.data) {
        Write-Host "  Data items: $($portfolio.data.Count)" -ForegroundColor Yellow
        foreach ($item in $portfolio.data) {
            if (-not $item.propertyTitle) {
                Write-Host "  ✗ ERROR: Missing propertyTitle in item: $($item.propertyId)" -ForegroundColor Red
            }
            if ($item.propertyTitle -match "undefined") {
                Write-Host "  ✗ ERROR: propertyTitle contains 'undefined': $($item.propertyTitle)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
}

Write-Host "`nTesting /api/investments/recent..." -ForegroundColor Cyan
try {
    $recent = Invoke-RestMethod "http://localhost:5000/api/investments/recent" -Method Get -Headers @{"Cookie"="connect.sid=test"} -ErrorAction Stop
    $recent | ConvertTo-Json -Depth 10 | Out-File "recent-test.json"
    
    Write-Host "✓ Recent endpoint responded" -ForegroundColor Green
    
    if ($recent.data) {
        Write-Host "  Recent items: $($recent.data.Count)" -ForegroundColor Yellow
        foreach ($item in $recent.data) {
            if (-not $item.propertyTitle) {
                Write-Host "  ✗ ERROR: Missing propertyTitle in item: $($item.propertyId)" -ForegroundColor Red
            }
            if ($item.propertyTitle -match "undefined") {
                Write-Host "  ✗ ERROR: propertyTitle contains 'undefined': $($item.propertyTitle)" -ForegroundColor Red
            }
            # Check required fields
            if (-not $item.status) { Write-Host "  ✗ ERROR: Missing status" -ForegroundColor Red }
            if (-not $item.amount) { Write-Host "  ✗ ERROR: Missing amount" -ForegroundColor Red }
            if (-not $item.createdAt) { Write-Host "  ✗ ERROR: Missing createdAt" -ForegroundColor Red }
            if (-not $item.propertyId) { Write-Host "  ✗ ERROR: Missing propertyId" -ForegroundColor Red }
        }
    }
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Cyan

