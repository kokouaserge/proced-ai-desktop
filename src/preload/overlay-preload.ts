// src/preload/overlay-preload.js
const {
  contextBridge: contextBridgeA,
  ipcRenderer: ipcRendererA,
} = require("electron");

console.log("Overlay preload script starting");

contextBridgeA.exposeInMainWorld("electron", {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  sendClick: (data: any) => {
    console.log("Sending click event to main process:", data);
    ipcRendererA.send("click-event", data);
  },
});

console.log("Overlay preload script finished, electron API exposed");

// Vérifier que l'API est bien exposée
window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded in preload");
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  console.log("Electron API available in window:", !!(window as any).electron);
});
