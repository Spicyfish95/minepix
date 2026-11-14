; Register an independent Open With entry. Never replace an extension's default.
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

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro MinePixRegisterType "pix" "MinePixTauri.Project" "MinePix Tauri binary project"
  !insertmacro MinePixRegisterType "ase" "MinePixTauri.Aseprite" "Aseprite animation"
  !insertmacro MinePixRegisterType "aseprite" "MinePixTauri.Aseprite" "Aseprite animation"
  WriteRegStr SHCTX "Software\Classes\MinePixTauri.Project\DefaultIcon" "" "$\"$INSTDIR\project-icon.ico$\""
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
  !insertmacro MinePixRemoveType "ase" "MinePixTauri.Aseprite"
  !insertmacro MinePixRemoveType "aseprite" "MinePixTauri.Aseprite"
  DeleteRegKey SHCTX "Software\Classes\MinePixTauri.Project"
  DeleteRegKey SHCTX "Software\Classes\MinePixTauri.Aseprite"
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\Classes\AppUserModelId\com.minepix.tauri"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
