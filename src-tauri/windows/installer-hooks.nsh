; Register Open With entries. Preserve existing user choices; initialize PIX only when unassigned.
!macro MinePixRegisterType EXT PROG DESCRIPTION
  WriteRegStr SHCTX "Software\Classes\${PROG}" "" "${DESCRIPTION}"
  WriteRegStr SHCTX "Software\Classes\${PROG}\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr SHCTX "Software\Classes\${PROG}\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  WriteRegStr SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${PROG}" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".${EXT}" ""
!macroend

!macro MinePixRemoveType EXT PROG
  DeleteRegValue SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${PROG}"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.${EXT}\OpenWithProgids"
!macroend

!macro MinePixRenameShortcut OLD NEW
  !insertmacro IsShortcutTarget "${OLD}" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 = 1
    Rename "${OLD}" "${NEW}"
    !insertmacro SetLnkAppUserModelId "${NEW}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro MinePixRenameShortcut "$SMPROGRAMS\MinePix Tauri.lnk" "$SMPROGRAMS\MinePix.lnk"
  !insertmacro MinePixRenameShortcut "$DESKTOP\MinePix Tauri.lnk" "$DESKTOP\MinePix.lnk"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro MinePixRegisterType "pix" "MinePixTauri.Project" "MinePix project"
  !insertmacro MinePixRegisterType "ase" "MinePixTauri.Aseprite" "Aseprite animation"
  !insertmacro MinePixRegisterType "aseprite" "MinePixTauri.Aseprite" "Aseprite animation"
  WriteRegStr SHCTX "Software\Classes\MinePixTauri.Project\DefaultIcon" "" "$\"$INSTDIR\project-icon.ico$\""
  ; Keep existing Explorer choices functional: Windows may retain Applications\MinePix.exe.
  !insertmacro MinePixRegisterType "pix" "MinePix.Project" "MinePix project"
  ReadRegStr $0 SHCTX "Software\Classes\.pix" ""
  ${If} $0 == ""
    WriteRegStr SHCTX "Software\Classes\.pix" "" "MinePix.Project"
  ${EndIf}
  WriteRegStr SHCTX "Software\Classes\MinePix.Project\DefaultIcon" "" "$\"$INSTDIR\project-icon.ico$\""
  WriteRegStr SHCTX "Software\Classes\Applications\MinePix.exe\DefaultIcon" "" "$\"$INSTDIR\project-icon.ico$\""
  WriteRegStr SHCTX "Software\Classes\Applications\MinePix.exe" "FriendlyAppName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\Applications\MinePix.exe\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  WriteRegStr SHCTX "Software\Classes\Applications\MinePix.exe\SupportedTypes" ".pix" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\DefaultIcon" "" "$\"$INSTDIR\project-icon.ico$\""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  WriteRegStr SHCTX "Software\Classes\AppUserModelId\com.minepix.tauri" "DisplayName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\AppUserModelId\com.minepix.tauri" "IconUri" "$INSTDIR\notification-icon.png"
  CreateDirectory "$APPDATA\${BUNDLEID}\update-cache"
  CopyFiles /SILENT "$EXEPATH" "$APPDATA\${BUNDLEID}\update-cache\base.exe"
  ClearErrors
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$APPDATA\${BUNDLEID}\update-cache\base.exe"
  RMDir "$APPDATA\${BUNDLEID}\update-cache"
  !insertmacro MinePixRemoveType "pix" "MinePixTauri.Project"
  !insertmacro MinePixRemoveType "pix" "MinePix.Project"
  ReadRegStr $0 SHCTX "Software\Classes\.pix" ""
  ${If} $0 == "MinePix.Project"
    DeleteRegValue SHCTX "Software\Classes\.pix" ""
  ${EndIf}
  DeleteRegKey /ifempty SHCTX "Software\Classes\.pix"
  DeleteRegKey SHCTX "Software\Classes\MinePix.Project"
  DeleteRegKey SHCTX "Software\Classes\Applications\MinePix.exe"
  !insertmacro MinePixRemoveType "ase" "MinePixTauri.Aseprite"
  !insertmacro MinePixRemoveType "aseprite" "MinePixTauri.Aseprite"
  DeleteRegKey SHCTX "Software\Classes\MinePixTauri.Project"
  DeleteRegKey SHCTX "Software\Classes\MinePixTauri.Aseprite"
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\AppUserModelId\com.minepix.tauri"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
