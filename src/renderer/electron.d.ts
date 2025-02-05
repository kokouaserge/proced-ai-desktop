export interface ElectronAPI {
  captureScreen: (cursorPosition: { x: number; y: number }) => Promise<string>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onStateChange: (callback: (event: any, value: any) => void) => () => void;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onScreenCapture: (callback: (event: any, value: any) => void) => () => void;
  checkPermissions: () => Promise<boolean>;
  onScreenCaptureError: (callback: (message: string) => void) => () => void;
  onScreenCaptureStatus: (
    callback: (status: "active" | "inactive") => void
  ) => () => void;
  startRecording: () => void;
  stopRecording: () => void;
  selectedWindow: (pid: string) => void;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  getOpenWindows: () => Promise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  desktopCapturer: (opts: any) => Promise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onRecordingStateChanged: (opts: any) => any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onPauseStateChanged: (opts: any) => any;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
