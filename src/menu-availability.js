const projectCommands='image-outline image-hsv image-brightness image-invert save save-as png normal-map sheet-pair gif sequence export-aseprite close-document color-mode swap-colors palette-editor import-palette export-palette extract-palette add-layer group-layer rename-layer layer-up layer-down duplicate-layer delete-layer layer-parent ungroup-layer toggle-background merge-down merge-visible flatten sprite-size canvas-size crop-selection trim-canvas flip-sprite-x flip-sprite-y slices select-color-range expand-selection contract-selection border-selection select-all select-content reselect deselect invert-selection transform-selection add-frame duplicate-frame delete-frame frame-left frame-right reverse-frames frame-fps copy-cels cut-cels paste-cels clear-cels move-cels transform-cels link-cels unlink-cels add-tag edit-tag delete-tag play previous next fit actual-size grid grid-toggle grid-settings onion onion-settings replace-color tileset-toggle copy paste clear'.split(' ');
const editingCommands='add-layer group-layer rename-layer layer-up layer-down duplicate-layer delete-layer layer-parent ungroup-layer toggle-background merge-down merge-visible flatten sprite-size canvas-size crop-selection trim-canvas flip-sprite-x flip-sprite-y slices transform-selection add-frame duplicate-frame delete-frame frame-left frame-right reverse-frames frame-fps cut-cels paste-cels clear-cels move-cels transform-cels link-cels unlink-cels add-tag edit-tag delete-tag replace-color tileset-toggle paste clear'.split(' ');

export function menuAvailability(state){
 const {hasDocument,canEdit,canEditPixels,hasSelection,hasPreviousSelection,hasCelRange,hasCelClipboard,hasClipboard,hasClosed,canUndo,canRedo,frameCount,frameIndex,layerCount,layerIndex,hasTags,hasSavedPath}=state;
 const enabled=Object.fromEntries(projectCommands.map(id=>[id,hasDocument]));
 for(const id of editingCommands)enabled[id]=hasDocument&&canEdit;
 enabled['capture-brush']=hasDocument&&canEditPixels&&hasSelection;
 enabled.undo=hasDocument&&canUndo;enabled.redo=hasDocument&&canRedo;
 enabled['reopen-document']=hasClosed;enabled.recover=hasDocument&&hasSavedPath;
 for(const id of ['image-outline','image-hsv','image-brightness','image-invert'])enabled[id]=hasDocument&&canEdit&&canEditPixels;
 enabled['replace-color']=enabled['replace-color']&&canEditPixels;
 enabled['tileset-toggle']=enabled['tileset-toggle']&&canEditPixels;
 enabled.copy=hasDocument&&canEditPixels;enabled.paste=enabled.paste&&canEditPixels&&hasClipboard;enabled.clear=enabled.clear&&canEditPixels;
 enabled['crop-selection']=enabled['crop-selection']&&hasSelection;enabled['transform-selection']=enabled['transform-selection']&&hasSelection&&canEditPixels;
 enabled['select-color-range']=hasDocument&&canEditPixels;for(const id of ['expand-selection','contract-selection','border-selection'])enabled[id]=hasDocument&&hasSelection;
 enabled.reselect=hasDocument&&hasPreviousSelection;enabled.deselect=hasDocument&&hasSelection;
 enabled['delete-layer']=enabled['delete-layer']&&layerCount>1;enabled['merge-down']=enabled['merge-down']&&layerIndex>0;
 enabled['delete-frame']=enabled['delete-frame']&&frameCount>1;enabled['reverse-frames']=enabled['reverse-frames']&&frameCount>1;
 enabled['frame-left']=enabled['frame-left']&&frameIndex>0;enabled['frame-right']=enabled['frame-right']&&frameIndex<frameCount-1;
 enabled.previous=hasDocument&&frameCount>1;enabled.next=hasDocument&&frameCount>1;
 for(const id of ['copy-cels','cut-cels','clear-cels','move-cels','transform-cels','link-cels','unlink-cels'])enabled[id]=enabled[id]&&hasCelRange;
 enabled['paste-cels']=enabled['paste-cels']&&hasCelRange&&hasCelClipboard;
 enabled['edit-tag']=enabled['edit-tag']&&hasTags;enabled['delete-tag']=enabled['delete-tag']&&hasTags;
 return enabled;
}
