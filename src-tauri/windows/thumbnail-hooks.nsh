!define MINEPIX_THUMB_CLSID "{B7972150-427A-4999-8FB5-8B1661C2510B}"
!define MINEPIX_THUMB_IID "{E357FCCD-A995-4576-B01F-234630154E96}"
!ifndef MINEPIX_THUMB_SOURCE
  !define MINEPIX_THUMB_SOURCE "${__FILEDIR__}\..\target\release\minepix_thumbnailer.dll"
!endif

; Prefer existing third-party providers, whether registered on the extension or ProgID.
!macro MinePixRegisterThumbnail EXT
  ReadRegStr $0 HKCR ".${EXT}\ShellEx\${MINEPIX_THUMB_IID}" ""
  ReadRegStr $1 HKCR ".${EXT}" ""
  ReadRegStr $2 HKCR "$1\ShellEx\${MINEPIX_THUMB_IID}" ""
  ReadRegStr $3 HKCR "SystemFileAssociations\.${EXT}\ShellEx\${MINEPIX_THUMB_IID}" ""
  ReadRegStr $4 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.${EXT}\UserChoice" "ProgId"
  ReadRegStr $5 HKCR "$4\ShellEx\${MINEPIX_THUMB_IID}" ""
  ${If} $0 == ""
  ${OrIf} $0 == "${MINEPIX_THUMB_CLSID}"
    ${If} $2 == ""
    ${OrIf} $2 == "${MINEPIX_THUMB_CLSID}"
      ${If} $3 == ""
      ${OrIf} $3 == "${MINEPIX_THUMB_CLSID}"
        ${If} $5 == ""
        ${OrIf} $5 == "${MINEPIX_THUMB_CLSID}"
          WriteRegStr HKCU "Software\Classes\.${EXT}\ShellEx\${MINEPIX_THUMB_IID}" "" "${MINEPIX_THUMB_CLSID}"
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro MinePixRemoveThumbnail EXT
  ReadRegStr $0 HKCU "Software\Classes\.${EXT}\ShellEx\${MINEPIX_THUMB_IID}" ""
  ${If} $0 == "${MINEPIX_THUMB_CLSID}"
    DeleteRegKey HKCU "Software\Classes\.${EXT}\ShellEx\${MINEPIX_THUMB_IID}"
    DeleteRegKey /ifempty HKCU "Software\Classes\.${EXT}\ShellEx"
    DeleteRegKey /ifempty HKCU "Software\Classes\.${EXT}"
  ${EndIf}
!macroend

!macro MinePixInstallThumbnails
  SetRegView 64
  ; Versioned DLLs let Explorer keep the previous loaded image during an update.
  SetOutPath "$INSTDIR\thumbnails\${VERSION}"
  SetOverwrite ifnewer
  File /oname=minepix-thumbnailer.dll "${MINEPIX_THUMB_SOURCE}"
  SetOverwrite on
  SetOutPath "$INSTDIR"
  WriteRegStr HKCU "Software\Classes\CLSID\${MINEPIX_THUMB_CLSID}" "" "MinePix thumbnail provider"
  WriteRegStr HKCU "Software\Classes\CLSID\${MINEPIX_THUMB_CLSID}\InprocServer32" "" "$INSTDIR\thumbnails\${VERSION}\minepix-thumbnailer.dll"
  WriteRegStr HKCU "Software\Classes\CLSID\${MINEPIX_THUMB_CLSID}\InprocServer32" "ThreadingModel" "Apartment"
  !insertmacro MinePixRegisterThumbnail "pix"
  !insertmacro MinePixRegisterThumbnail "ase"
  !insertmacro MinePixRegisterThumbnail "aseprite"
!macroend

!macro MinePixUninstallThumbnails
  SetRegView 64
  ReadRegStr $0 HKCU "Software\Classes\CLSID\${MINEPIX_THUMB_CLSID}\InprocServer32" ""
  ${If} $0 == "$INSTDIR\thumbnails\${VERSION}\minepix-thumbnailer.dll"
    !insertmacro MinePixRemoveThumbnail "pix"
    !insertmacro MinePixRemoveThumbnail "ase"
    !insertmacro MinePixRemoveThumbnail "aseprite"
    DeleteRegKey HKCU "Software\Classes\CLSID\${MINEPIX_THUMB_CLSID}"
  ${EndIf}
  ; Surrogate processes may hold a DLL until their idle timeout. Schedule those files.
  Delete /REBOOTOK "$INSTDIR\thumbnails\${VERSION}\minepix-thumbnailer.dll"
  RMDir /REBOOTOK "$INSTDIR\thumbnails\${VERSION}"
  RMDir /REBOOTOK "$INSTDIR\thumbnails"
  RMDir "$INSTDIR"
!macroend
