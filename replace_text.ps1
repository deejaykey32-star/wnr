$appFile = 'c:\dev\Projekt 07.08.2026\wnr\src\App.tsx'
$blogFile = 'c:\dev\Projekt 07.08.2026\wnr\src\components\BlogSection.tsx'

$content = [System.IO.File]::ReadAllText($appFile)
$content = $content.Replace("text-black", "light-mode-text")
[System.IO.File]::WriteAllText($appFile, $content)

$content2 = [System.IO.File]::ReadAllText($blogFile)
$content2 = $content2.Replace("text-black", "light-mode-text")
[System.IO.File]::WriteAllText($blogFile, $content2)

Write-Host "Done!"
