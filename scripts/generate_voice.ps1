Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice("Microsoft Hedda Desktop")
$speaker.Rate = 1
$outFile = Join-Path (Get-Location) "social_content\voice_test.wav"
$speaker.SetOutputToWaveFile($outFile)
$speaker.Speak("Kein Clickbait, keine Meinungsmache. Hier sind die Fakten zum Physik-Nobelpreis auf PLAIN Punkt ch.")
$speaker.Dispose()
Write-Host "Generated: $outFile"
