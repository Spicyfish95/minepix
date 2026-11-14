import {initializeDesktop} from './desktop.js';

await initializeDesktop();
await import('./app.js');
await window.chromeReady;
await window.desktop.editorReady();
