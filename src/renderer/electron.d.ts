interface Auth {
  token: string;
  user_id: string;
  expires: number;
  intercom_hash?: string;
  plan?: {
    upgraded: boolean;
    last_checked: number;
    manual: boolean;
  };
}

export interface ElectronAPI {
  captureScreen: (cursorPosition: { x: number; y: number }) => Promise<string>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onStateChange: (callback: (event: any, value: any) => void) => () => void;
  openInDefaultBrowser: (url: string) => void;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onScreenCapture: (callback: (event: any, value: any) => void) => () => void;
  checkPermissions: () => Promise<boolean>;
  onScreenCaptureError: (callback: (message: string) => void) => () => void;
  onScreenCaptureStatus: (
    callback: (status: "active" | "inactive") => void
  ) => () => void;
  startRecording: () => void;
  stopRecording: () => void;
  togglePause: () => void;
  restartRecording: () => void;
  selectedWindow: (pid: string) => void;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  getOpenWindows: () => Promise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  desktopCapturer: (opts: any) => Promise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onRecordingStateChanged: (opts: any) => any;

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onRecordingRestarted: (opts: any) => any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  onPauseStateChanged: (opts: any) => any;
  checkPermissionsSetup: () => Promise<boolean>;
  requestPermission: (permission: string) => Promise<boolean>;
  createDirectories: () => Promise<boolean>;
  completeSetup: () => Promise<boolean>;

  auth: {
    // Démarrer le processus d'authentification
    start: () => Promise<boolean>;

    // Vérifier l'état de l'authentification
    check: () => Promise<Auth | null>;

    // Se déconnecter
    logout: () => Promise<boolean>;

    // Rafraîchir le token
    refresh: () => Promise<boolean>;

    // Écouter les événements d'authentification
    onSuccess: (callback: (auth: Auth) => void) => () => void;
    onError: (callback: (error: Error) => void) => () => void;
    onLogout: (callback: () => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
