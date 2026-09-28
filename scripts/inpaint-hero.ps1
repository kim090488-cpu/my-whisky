Add-Type -AssemblyName System.Drawing

# Inpaint the baked-in "whiskey blind × ds.whiskey" text from hero images.
# Approach: detect bright grayscale pixels in text bbox -> dilate mask ->
#   iterative fill using average of non-mask neighbors in 21x21 window.

$heroes = @("hero1", "hero2", "hero3")
$srcDir = "D:\my-whisky\mobile\assets\hero"

# Text bounding box (in 682x400 cropped image)
$bboxX1 = 25
$bboxX2 = 420
$bboxY1 = 85
$bboxY2 = 275

# Detection thresholds
$lumThresh = 175         # min luminance for text pixel
$chromaThresh = 45       # max R-G-B spread (grayscale-ish)

# Inpainting window radius
$radius = 12
$iterations = 2

function Invoke-Inpaint {
  param([string]$imagePath, [string]$outPath)

  # Load through a stream so the source file isn't kept locked
  $bytesIn = [System.IO.File]::ReadAllBytes($imagePath)
  $ms = New-Object System.IO.MemoryStream (,$bytesIn)
  $bmp = [System.Drawing.Bitmap]::FromStream($ms)
  $ms.Dispose()
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
                        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $stride = $data.Stride
  $totalBytes = $stride * $h
  $buf = New-Object byte[] $totalBytes
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $totalBytes)

  # Build initial text mask
  $mask = New-Object bool[] ($w * $h)
  for ($y = $bboxY1; $y -lt $bboxY2; $y++) {
    $row = $y * $stride
    for ($x = $bboxX1; $x -lt $bboxX2; $x++) {
      $i = $row + $x * 3
      $b = $buf[$i]
      $g = $buf[$i+1]
      $r = $buf[$i+2]
      $lum = ([int]$r + [int]$g + [int]$b) / 3
      $mx = [Math]::Max([Math]::Max($r, $g), $b)
      $mn = [Math]::Min([Math]::Min($r, $g), $b)
      if ($lum -gt $lumThresh -and ($mx - $mn) -lt $chromaThresh) {
        $mask[$y * $w + $x] = $true
      }
    }
  }

  # Dilate mask by 2 pixels to catch anti-aliased edges
  $dilated = New-Object bool[] ($w * $h)
  $dilR = 2
  for ($y = $bboxY1 - $dilR; $y -lt $bboxY2 + $dilR; $y++) {
    if ($y -lt 0 -or $y -ge $h) { continue }
    for ($x = $bboxX1 - $dilR; $x -lt $bboxX2 + $dilR; $x++) {
      if ($x -lt 0 -or $x -ge $w) { continue }
      $hit = $false
      for ($dy = -$dilR; $dy -le $dilR -and (-not $hit); $dy++) {
        $ny = $y + $dy
        if ($ny -lt 0 -or $ny -ge $h) { continue }
        for ($dx = -$dilR; $dx -le $dilR; $dx++) {
          $nx = $x + $dx
          if ($nx -lt 0 -or $nx -ge $w) { continue }
          if ($mask[$ny * $w + $nx]) { $hit = $true; break }
        }
      }
      $dilated[$y * $w + $x] = $hit
    }
  }
  $mask = $dilated

  # Count mask pixels
  $count = 0
  for ($i = 0; $i -lt $mask.Length; $i++) { if ($mask[$i]) { $count++ } }
  "  text mask pixels: $count"

  # Iterative inpainting: for each mask pixel, average of non-mask neighbors in window
  for ($iter = 0; $iter -lt $iterations; $iter++) {
    $newBuf = [byte[]]::new($totalBytes)
    [Array]::Copy($buf, $newBuf, $totalBytes)
    for ($y = $bboxY1 - $radius; $y -lt $bboxY2 + $radius; $y++) {
      if ($y -lt 0 -or $y -ge $h) { continue }
      for ($x = $bboxX1 - $radius; $x -lt $bboxX2 + $radius; $x++) {
        if ($x -lt 0 -or $x -ge $w) { continue }
        if (-not $mask[$y * $w + $x]) { continue }
        $sumR = 0.0; $sumG = 0.0; $sumB = 0.0; $wSum = 0.0
        for ($dy = -$radius; $dy -le $radius; $dy++) {
          $ny = $y + $dy
          if ($ny -lt 0 -or $ny -ge $h) { continue }
          for ($dx = -$radius; $dx -le $radius; $dx++) {
            $nx = $x + $dx
            if ($nx -lt 0 -or $nx -ge $w) { continue }
            if ($mask[$ny * $w + $nx]) { continue }
            $dist2 = $dx * $dx + $dy * $dy
            if ($dist2 -eq 0) { continue }
            $weight = 1.0 / $dist2
            $ni = $ny * $stride + $nx * 3
            $sumB += $buf[$ni] * $weight
            $sumG += $buf[$ni+1] * $weight
            $sumR += $buf[$ni+2] * $weight
            $wSum += $weight
          }
        }
        if ($wSum -gt 0) {
          $i = $y * $stride + $x * 3
          $newBuf[$i] = [byte][Math]::Min(255, [Math]::Max(0, $sumB / $wSum))
          $newBuf[$i+1] = [byte][Math]::Min(255, [Math]::Max(0, $sumG / $wSum))
          $newBuf[$i+2] = [byte][Math]::Min(255, [Math]::Max(0, $sumR / $wSum))
        }
      }
    }
    $buf = $newBuf
  }

  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $totalBytes)
  $bmp.UnlockBits($data)

  # Save as JPEG q85
  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
  $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
    [System.Drawing.Imaging.Encoder]::Quality), 85L
  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" }
  $bmp.Save($outPath, $jpegCodec, $encoderParams)
  $bmp.Dispose()
}

foreach ($h in $heroes) {
  $src = Join-Path $srcDir "$h.jpg"
  $dst = Join-Path $srcDir "$h.jpg"
  "processing $h..."
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Invoke-Inpaint -imagePath $src -outPath $dst
  $sw.Stop()
  "  done in $($sw.Elapsed.TotalSeconds.ToString('0.0'))s -> $dst"
}
