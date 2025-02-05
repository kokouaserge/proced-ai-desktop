const { contextBridge, ipcRenderer } = require("electron");
const { screen: electronScreen } = require("electron"); // Renommé pour éviter le conflit

contextBridge.exposeInMainWorld("electronAPI", {
  captureScreen: async (cursorPosition: { x: number; y: number }) => {
    try {
      console.log(cursorPosition);
      return await ipcRenderer.invoke("capture-screen");
    } catch (error) {
      console.error("Error capturing screen:", error);
      throw error;
    }
  },
  checkPermissions: () => ipcRenderer.invoke("check-permissions"),

  togglePause: () => ipcRenderer.send("toggle-pause"),

  requestPermissions: () => ipcRenderer.invoke("request-permissions"),

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onScreenCapture: (callback: (arg0: any) => any) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ipcRenderer.on("click-captured", (_: any, message: any) =>
      callback(message)
    );
    return () => {
      ipcRenderer.removeListener("click-captured", callback);
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onScreenCaptureError: (callback: (arg0: any) => any) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ipcRenderer.on("screen-capture-error", (_: any, message: any) =>
      callback(message)
    );
    return () => {
      ipcRenderer.removeListener("screen-capture-error", callback);
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onScreenCaptureStatus: (callback: (arg0: any) => any) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ipcRenderer.on("screen-capture-status", (_: any, status: any) =>
      callback(status)
    );
    return () => {
      ipcRenderer.removeListener("screen-capture-status", callback);
    };
  },

  startRecording: () => ipcRenderer.invoke("start-recording"),
  stopRecording: () => ipcRenderer.invoke("stop-recording"),
  selectedWindow: (pid: string) => ipcRenderer.invoke("select-window", pid),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  desktopCapturer: async (opts: any) => ipcRenderer.invoke("GET_SOURCES", opts),

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onRecordingStateChanged: (callback: (arg0: any) => any) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ipcRenderer.on("recording-state-changed", (_: any, message: any) =>
      callback(message)
    );
    return () => {
      ipcRenderer.removeListener("recording-state-changed", callback);
    };
  },

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onPauseStateChanged: (callback: (arg0: any) => any) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ipcRenderer.on("toggle-paused", (_: any, message: any) =>
      callback(message)
    );
    return () => {
      ipcRenderer.removeListener("toggle-paused", callback);
    };
  },
});
