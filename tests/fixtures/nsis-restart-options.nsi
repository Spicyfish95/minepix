Unicode true
RequestExecutionLevel user
SilentInstall silent
Name "MinePix NSIS argument parser check"
OutFile "${OUTPUT}"
!include FileFunc.nsh
Section
  StrCpy $0 '/S /UPDATE /R /ARGS "--update-validation=http://127.0.0.1:19412/latest.json" "C:\MinePix\含空格 作品.pix"'
  ${GetOptions} $0 "/ARGS" $1
  StrCmp $1 '"--update-validation=http://127.0.0.1:19412/latest.json" "C:\MinePix\含空格 作品.pix"' failed
  StrCpy $0 '/S /UPDATE /R /ARGS "--update-validation=http://127.0.0.1:19412/latest.json" "C:\MinePix\含空格 作品.pix" --minepix-updated'
  ${GetOptions} $0 "/ARGS" $1
  StrCmp $1 '"--update-validation=http://127.0.0.1:19412/latest.json" "C:\MinePix\含空格 作品.pix" --minepix-updated' 0 failed
  FileOpen $2 "$EXEDIR\parser-result.json" w
  FileWrite $2 '{"ok":true,"originalQuoteLossReproduced":true,"tailPreservesExactArguments":true}'
  FileClose $2
  SetErrorLevel 0
  Quit
failed:
  SetErrorLevel 1
SectionEnd
