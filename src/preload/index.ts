import { contextBridge, ipcRenderer } from "electron";

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
  onScreenCapture: (callback: any) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on("click-captured", subscription);
    return () => {
      ipcRenderer.removeListener("click-captured", subscription);
    };
  },
  openInDefaultBrowser: (url: string) =>
    ipcRenderer.invoke("shell:open-url", url),
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
  restartRecording: () => ipcRenderer.invoke("restart-recording"),
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
  onRecordingRestarted: (callback: (arg0: any) => any) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ipcRenderer.on("restarted-recording", (_: any, message: any) =>
      callback(message)
    );
    return () => {
      ipcRenderer.removeListener("restarted-recording", callback);
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

  auth: {
    start: () => ipcRenderer.invoke("auth:start"),
    check: () => ipcRenderer.invoke("auth:check"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    onSuccess: (callback: (arg0: any) => any) => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const subscription = (_event: any, data: any) => callback(data);
      ipcRenderer.on("auth:success", subscription);
      return () => {
        ipcRenderer.removeListener("auth:success", subscription);
      };
    },
  },

  /**
   * Vérifie les permissions requises
   * @returns {Promise<{granted: boolean, missing: string[]}>} Statut des permissions
   */
  checkPermissionsSetup: () => ipcRenderer.invoke("setup:check-permissions"),

  /**
   * Demande une permission spécifique
   * @param {string} permission - Nom de la permission à demander
   * @returns {Promise<boolean>} - Succès de la demande
   */

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  requestPermission: (permission: any) =>
    ipcRenderer.invoke("setup:request-permission", permission),

  /**
   * Crée les répertoires nécessaires à l'application
   * @returns {Promise<boolean>} - Succès de la création
   */
  createDirectories: () => ipcRenderer.invoke("setup:create-directories"),

  /**
   * Termine le processus d'installation
   * @returns {Promise<boolean>} - Succès de la complétion
   */
  completeSetup: () => ipcRenderer.invoke("setup:complete"),
});
