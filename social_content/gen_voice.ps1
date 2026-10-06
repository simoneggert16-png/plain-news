
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice("Microsoft Hedda Desktop")
$speaker.Rate = 0
$outFile = "C:\\Users\\Simon\\.gemini\\antigravity\\scratch\\plain-news\\social_content\\nobel_voice.wav"
$speaker.SetOutputToWaveFile($outFile)
$speaker.Speak("Kein Klickbejt. Keine Meinungsmache. Francis Halzen gewinnt den Nobelpreis für Physik 2026 für seine Arbeit am Ice-Cube Neutrino Observatorium am Südpol. Tausende Lichtsensoren im ewigen Eis spüren hochenergetische Geisterteilchen aus fernen Galaxien auf. Alle Primärquellen ohne Werbung auf plain news Punkt c h.")
$speaker.Dispose()
