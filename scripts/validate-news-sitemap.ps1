param([Parameter(Mandatory=$true)][string]$PackageRoot)
$ErrorActionPreference = 'Stop'
$SitemapNs = 'http://www.sitemaps.org/schemas/sitemap/0.9'
$NewsNs = 'http://www.google.com/schemas/sitemap-news/0.9'
$Manifest = Get-Content -LiteralPath (Join-Path $PackageRoot 'tests/xml-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$script:ValidatedFiles = 0
$script:EmptyWarnings = 0
function Assert-True($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Read-Xml([string]$Relative, [string]$Schema = '') {
  $file = Join-Path $PackageRoot $Relative
  $settings = New-Object System.Xml.XmlReaderSettings
  $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
  $settings.XmlResolver = $null
  $errors = New-Object 'System.Collections.Generic.List[string]'
  if ($Schema) {
    $settings.ValidationType = [System.Xml.ValidationType]::Schema
    $settings.Schemas.XmlResolver = $null
    [void]$settings.Schemas.Add($SitemapNs, (Join-Path $PackageRoot ('evidence/schemas/' + $Schema + '.xsd')))
    if ($Schema -eq 'sitemap') { [void]$settings.Schemas.Add($NewsNs, (Join-Path $PackageRoot 'evidence/schemas/sitemap-news.xsd')) }
    $settings.add_ValidationEventHandler({ param($sender, $eventArgs) [void]$errors.Add($eventArgs.Message) })
  }
  $reader = [System.Xml.XmlReader]::Create($file, $settings)
  $doc = New-Object System.Xml.XmlDocument
  $doc.XmlResolver = $null
  try { $doc.Load($reader) } finally { $reader.Dispose() }
  Assert-True ($errors.Count -eq 0) ($Relative + ': XSD: ' + ($errors -join '; '))
  $script:ValidatedFiles++
  return ,$doc
}
function Namespace-Manager($Doc) {
  $ns = New-Object System.Xml.XmlNamespaceManager($Doc.NameTable)
  $ns.AddNamespace('sm', $SitemapNs)
  $ns.AddNamespace('news', $NewsNs)
  return ,$ns
}
function Extract-News($Doc, [bool]$CheckLimit = $true) {
  $ns = Namespace-Manager $Doc
  Assert-True ($Doc.DocumentElement.LocalName -eq 'urlset' -and $Doc.DocumentElement.NamespaceURI -eq $SitemapNs) 'Invalid child root/namespace'
  $urls = $Doc.SelectNodes('/sm:urlset/sm:url', $ns)
  $newsCount = $Doc.SelectNodes('//news:news', $ns).Count
  if ($CheckLimit) { Assert-True ($newsCount -le 1000) 'More than 1000 news elements' }
  Assert-True ($newsCount -eq $urls.Count) 'Exactly one news element is required per advertised news URL'
  $result = New-Object 'System.Collections.Generic.List[object]'
  foreach ($url in $urls) {
    Assert-True ($url.SelectNodes('sm:loc', $ns).Count -eq 1) 'Missing/duplicate canonical loc'
    Assert-True ($url.SelectNodes('news:news', $ns).Count -eq 1) 'Missing/duplicate news metadata'
    Assert-True ($url.SelectNodes('news:news/news:publication', $ns).Count -eq 1) 'Missing publication'
    $loc = $url.SelectSingleNode('sm:loc', $ns).InnerText
    $language = $url.SelectSingleNode('news:news/news:publication/news:language', $ns).InnerText
    $date = $url.SelectSingleNode('news:news/news:publication_date', $ns).InnerText
    $title = $url.SelectSingleNode('news:news/news:title', $ns).InnerText
    $name = $url.SelectSingleNode('news:news/news:publication/news:name', $ns).InnerText
    Assert-True (-not [string]::IsNullOrWhiteSpace($title)) 'Empty title'
    $instant = [DateTimeOffset]::Parse($date, [Globalization.CultureInfo]::InvariantCulture).ToUnixTimeMilliseconds()
    Assert-True ($instant -ge ([long]$Manifest.referenceTime - 172800000) -and $instant -le [long]$Manifest.referenceTime) 'Outside 48h or future date'
    Assert-True ($loc.StartsWith($Manifest.origin + '/')) 'Off-origin article URL'
    [void]$result.Add([PSCustomObject]@{ loc=$loc; title=$title; language=$language; publicationDate=$date; name=$name })
  }
  return ,$result
}

$index = Read-Xml $Manifest.index 'siteindex'
$ns = Namespace-Manager $index
Assert-True ($index.DocumentElement.LocalName -eq 'sitemapindex') 'Index is not sitemapindex'
$links = @($index.SelectNodes('/sm:sitemapindex/sm:sitemap/sm:loc', $ns) | ForEach-Object { $_.InnerText })
Assert-True ($links.Count -eq $Manifest.children.Count) 'Index child count mismatch'
Assert-True (@($links | Select-Object -Unique).Count -eq $links.Count) 'Duplicate index child'
$all = New-Object 'System.Collections.Generic.List[object]'
foreach ($child in $Manifest.children) {
  Assert-True ($links -contains $child.url) 'Index references unexpected/missing child'
  $uri = [Uri]$child.url
  Assert-True ($uri.GetLeftPart([UriPartial]::Authority) -eq $Manifest.origin) 'Off-origin child'
  Assert-True ($uri.AbsolutePath -match '^/news-sitemap/[1-9][0-9]*\.xml$') 'Invalid child path'
  $doc = Read-Xml $child.file 'sitemap'
  $rows = Extract-News $doc
  Assert-True ($rows.Count -eq $child.count) 'Wrong child count'
  foreach ($row in $rows) { [void]$all.Add($row) }
}
$byUrl = @{}
foreach ($row in $all) { Assert-True (-not $byUrl.ContainsKey($row.loc)) ('Duplicate canonical URL: ' + $row.loc); $byUrl[$row.loc] = $row }
Assert-True ($byUrl.Count -eq $Manifest.expected.Count) 'Source completeness mismatch'
foreach ($expected in $Manifest.expected) {
  Assert-True ($byUrl.ContainsKey($expected.loc)) ('Lost source URL: ' + $expected.loc)
  $actual = $byUrl[$expected.loc]
  foreach ($field in @('loc','name','title','language','publicationDate')) { Assert-True ($actual.$field -ceq $expected.$field) ('Metadata mismatch: ' + $field + ' ' + $expected.loc) }
}
$liveDoc = Read-Xml $Manifest.originalLive
$live = Extract-News $liveDoc $false
Assert-True ($live.Count -eq $all.Count) 'Captured live URL completeness mismatch'
foreach ($row in $live) {
  Assert-True ($byUrl.ContainsKey($row.loc)) ('Lost captured live URL: ' + $row.loc)
  $expectedLanguage = if ($row.language -eq 'zh') { 'zh-cn' } else { $row.language }
  Assert-True ($byUrl[$row.loc].language -ceq $expectedLanguage) 'Language not preserved/corrected'
  foreach ($field in @('name','title','publicationDate')) { Assert-True ($byUrl[$row.loc].$field -ceq $row.$field) ('Captured live metadata changed: ' + $field) }
}
foreach ($case in $Manifest.fixtureCases) {
  $count = 0
  foreach ($part in $case.files) {
    if ($part.intentionalEmpty) {
      # Official base XSD requires >=1 URL; Google expressly permits an empty
      # news sitemap and may show an informational Empty Sitemap warning.
      $doc = Read-Xml $part.file
      $script:EmptyWarnings++
    } else { $doc = Read-Xml $part.file 'sitemap' }
    $rows = Extract-News $doc
    Assert-True ($rows.Count -eq $part.count) 'Boundary XML count mismatch'
    $count += $rows.Count
    foreach ($row in $rows) { Assert-True ($row.title.Contains('& <tag>')) 'XML text/entities did not round-trip' }
  }
  Assert-True ($count -eq $case.n) 'Boundary XML completeness mismatch'
}
# Negative controls: malformed XML and namespace errors must really fail validation.
$bad = New-Object System.Xml.XmlDocument
$failed = $false
try { $bad.LoadXml('<urlset><url></urlset>') } catch { $failed = $true }
Assert-True $failed 'Malformed XML negative control unexpectedly passed'
$bad.LoadXml('<urlset xmlns="urn:wrong"/>')
Assert-True ($bad.DocumentElement.NamespaceURI -ne $SitemapNs) 'Wrong namespace control unexpectedly passed'
$negativeSettings = New-Object System.Xml.XmlReaderSettings
$negativeSettings.ValidationType = [System.Xml.ValidationType]::Schema
$negativeSettings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$negativeSettings.XmlResolver = $null
[void]$negativeSettings.Schemas.Add($SitemapNs, (Join-Path $PackageRoot 'evidence/schemas/sitemap.xsd'))
[void]$negativeSettings.Schemas.Add($NewsNs, (Join-Path $PackageRoot 'evidence/schemas/sitemap-news.xsd'))
$schemaErrors = New-Object 'System.Collections.Generic.List[string]'
$negativeSettings.add_ValidationEventHandler({ param($sender, $eventArgs) [void]$schemaErrors.Add($eventArgs.Message) })
$invalidNews = '<urlset xmlns="' + $SitemapNs + '" xmlns:news="' + $NewsNs + '"><url><loc>https://www.plain-news.ch/en/a/test</loc><news:news/></url></urlset>'
$negativeReader = [System.Xml.XmlReader]::Create((New-Object System.IO.StringReader($invalidNews)), $negativeSettings)
try { while ($negativeReader.Read()) {} } finally { $negativeReader.Dispose() }
Assert-True ($schemaErrors.Count -gt 0) 'Missing required news metadata unexpectedly passed XSD'
$dtdBlocked = $false
try {
  $dtdReader = [System.Xml.XmlReader]::Create((New-Object System.IO.StringReader('<!DOCTYPE urlset [<!ENTITY x "test">]><urlset/>')), $negativeSettings)
  try { while ($dtdReader.Read()) {} } finally { $dtdReader.Dispose() }
} catch { $dtdBlocked = $true }
Assert-True $dtdBlocked 'DTD negative control unexpectedly passed'
[PSCustomObject]@{ status='PASS'; xmlFiles=$script:ValidatedFiles; liveEntries=$live.Count; uniqueEntries=$byUrl.Count; childCounts=@($Manifest.children | ForEach-Object { $_.count }); intentionalEmptyGoogleWarning=$script:EmptyWarnings; schemas='Official sitemap + siteindex + Google news XSD, local/offline'; exactSourceAndLiveMetadata=$true } | ConvertTo-Json -Depth 5
