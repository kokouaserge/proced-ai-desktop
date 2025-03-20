import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  systemPreferences,
  nativeImage,
  screen,
  shell,
  dialog,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { uIOhook } from "uiohook-napi";
import { exec } from "node:child_process";
import { store } from "./store";

const NAME_STORE_AUTH = "proced_ai_auth";

let isRecording = false;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let mainWindow: BrowserWindow;
const SETUP_COMPLETED_KEY = "setup_completed";
const APP_VERSION_KEY = "app_version";

//Windows

let setupWindow: BrowserWindow | null = null;
let buttonInProgressWindow: BrowserWindow | null = null;
let editorWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;

let lastClickTime = 0;

let selectedPid: string | null = null;

const CLICK_THRESHOLD = 500;

let isPaused = false;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let captureBuffer: any = null;
//let lastCaptureTime = 0;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let updateBufferInterval: any = null;
const CAPTURE_INTERVAL = 100; // ms

const SETUP_COMPLETE_FLAG = "--setup-complete";

// Vérifier si l'application démarre avec le flag d'installation terminée
const isSetupCompleteFlag = process.argv.includes(SETUP_COMPLETE_FLAG);

function isSetupCompleted(): boolean {
  const setupCompleted = store.getItem(SETUP_COMPLETED_KEY);
  const currentVersion = app.getVersion();
  const storedVersion = store.getItem(APP_VERSION_KEY);

  // Si l'installation n'a jamais été faite ou si la version a changé
  return setupCompleted === true && storedVersion === currentVersion;
}

function ensureAppDirectories() {
  const userDataPath = app.getPath("userData");
  const requiredDirs = [
    path.join(userDataPath, "captures"),
    path.join(userDataPath, "recordings"),
    path.join(userDataPath, "logs"),
  ];

  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Ouvre l'URL spécifiée dans le navigateur par défaut du système.
 *
 * @param url L'URL à ouvrir dans le navigateur
 * @returns Une promesse résolue avec true si l'ouverture a réussi, ou rejetée avec une erreur
 */
export async function openInDefaultBrowser(url: string): Promise<boolean> {
  try {
    // Méthode recommandée: utiliser shell.openExternal d'Electron
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error("Erreur lors de l'ouverture du navigateur:", error);
    throw error;
  }
}

/* function resetSetup() {
  store.removeItem(SETUP_COMPLETED_KEY);
  store.removeItem(APP_VERSION_KEY);
  store.removeItem(NAME_STORE_AUTH);
} */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function broadcastToAllWindows(channel: string, ...args: any[]) {
  return new Promise<void>((resolve, reject) => {
    try {
      const windows = [
        mainWindow,
        editorWindow,
        buttonInProgressWindow,
        authWindow,
      ].filter((window) => window !== null && !window.isDestroyed());

      // Vérifier qu'il y a des fenêtres à notifier
      if (windows.length === 0) {
        console.warn("Aucune fenêtre disponible pour diffuser le message");
        return resolve();
      }

      // biome-ignore lint/complexity/noForEach: <explanation>
      windows.forEach((window) => {
        try {
          if (window?.webContents && !window.webContents.isDestroyed()) {
            window.webContents.send(channel, ...args);
          }
        } catch (err) {
          console.warn(`Erreur lors de l'envoi à une fenêtre:`, err);
          // Continuer avec les autres fenêtres même si une échoue
        }
      });

      resolve();
    } catch (error) {
      console.error("Erreur dans broadcastToAllWindows:", error);
      reject(error);
    }
  });
}

// Fonction pour obtenir le PID selon le système d'exploitation
function getWindowPid(windowTitle: string) {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      // Pour Windows
      exec(
        `powershell "Get-Process | Where-Object {$_.MainWindowTitle -like '*${windowTitle}*'} | Select-Object Id"`,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (error: any, stdout: string) => {
          if (!error && stdout) {
            const pid = stdout.trim().split("\n")[1]; // Le premier est l'en-tête "Id"
            resolve(pid ? Number.parseInt(pid) : null);
          } else {
            resolve(null);
          }
        }
      );
    } else if (process.platform === "darwin") {
      // Pour macOS
      exec(
        `ps ax -o pid,command | grep "${windowTitle}"`,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (error: any, stdout: string) => {
          if (!error && stdout) {
            const pid = stdout.trim().split(" ")[0];
            resolve(pid ? Number.parseInt(pid) : null);
          } else {
            resolve(null);
          }
        }
      );
    } else {
      // Pour Linux
      exec(
        `xdotool search --name "${windowTitle}" getwindowpid`,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (error: any, stdout: string) => {
          if (!error && stdout) {
            resolve(Number.parseInt(stdout.trim()));
          } else {
            resolve(null);
          }
        }
      );
    }
  });
}

function getActivePid() {
  return new Promise((resolve, reject) => {
    if (process.platform === "win32") {
      // Windows
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();
            
            [DllImport("user32.dll")]
            public static extern Int32 GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
          }
"@
        $hwnd = [Win32]::GetForegroundWindow()
        $processId = 0
        [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
        $processId
      `;

      exec(
        // biome-ignore lint/style/useTemplate: <explanation>
        'powershell -command "' + script + '"',
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (error: any, stdout: string) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(Number.parseInt(stdout.trim()));
        }
      );
    } else if (process.platform === "darwin") {
      // macOS
      exec(
        `osascript -e 'tell application "System Events" to get unix id of first process whose frontmost is true'`,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (error: any, stdout: string) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(Number.parseInt(stdout.trim()));
        }
      );
    } else {
      // Linux

      exec(
        "xdotool getwindowfocus getwindowpid",
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (error: any, stdout: string) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(Number.parseInt(stdout.trim()));
        }
      );
    }
  });
}

async function hasScreenCapturePermission(): Promise<boolean> {
  if (process.platform === "darwin") {
    // Pour macOS
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 100, height: 100 },
      });
      return sources.length > 0;
    } catch (error) {
      console.error("Screen capture permission check failed:", error);
      return false;
    }
  } else if (process.platform === "win32") {
    // Pour Windows, on suppose que les permissions sont accordées
    // car Windows gère ça au niveau de l'application
    return true;
  }
  return true; // Pour les autres OS
}

async function checkScreenCapturePermission(): Promise<boolean> {
  if (process.platform !== "darwin") {
    return true; // Sur les autres OS, pas besoin de permission
  }

  try {
    // Vérifier si on a déjà la permission
    const status = systemPreferences.getMediaAccessStatus("screen");
    if (status === "granted") {
      return true;
    }

    // Demander la permission
    const hasPermission = await systemPreferences.askForMediaAccess(
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      "screen" as any
    );
    return hasPermission;
  } catch (error) {
    console.error("Error checking screen capture permission:", error);
    return false;
  }
}

function requestScreenCaptureAccess() {
  if (process.platform === "darwin") {
    // Déclencher la boîte de dialogue de permission système
    desktopCapturer
      .getSources({
        types: ["screen"],
        thumbnailSize: { width: 1, height: 1 },
      })
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      .catch((err: any) => {
        console.error("Failed to request screen capture access:", err);
      });
  }
}

function createWindow() {
  const MAIN_WINDOW_SIZE = { width: 300, height: 360 };
  mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_SIZE.width,
    height: MAIN_WINDOW_SIZE.height,
    icon: path.join(__dirname, "../assets/icon-128.png"),
    titleBarStyle: "hidden",
    // expose window controlls in Windows/Linux
    ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "../preload/index.js"),
      // enableRemoteModule: true,
    },
  });

  mainWindow.setOverlayIcon(
    nativeImage.createFromPath("../assets/icon-128.png"),
    "Description for overlay"
  );

  mainWindow.on("resize", () => {
    mainWindow.setSize(MAIN_WINDOW_SIZE.width, MAIN_WINDOW_SIZE.height);
  });

  // En développement, charge l'URL de dev de Vite
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    console.log("Loading development URL");
  } else {
    // En production, charge le fichier HTML buildé
    const htmlPath = path.resolve(__dirname, "../renderer/index.html");
    console.log("Loading production path:", htmlPath);
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    mainWindow.loadFile(htmlPath).catch((err: any) => {
      console.error("Error loading file:", err);
    });
  }

  mainWindow.setOverlayIcon(
    nativeImage.createFromPath("../assets/icon-128.png"),
    "Description for overlay"
  );

  // Pour Windows : gérer la notification système pour l'enregistrement d'écran
  mainWindow.on("focus", () => {
    if (process.platform === "win32") {
      mainWindow?.webContents.send("screen-capture-status", "active");
    }
  });
}

function createWindowInProgressButtons() {
  const width = 180 + 32; // Same as `let mut width = 180.0; width += 32.0;`
  const height = 40;

  if (mainWindow) {
    mainWindow.minimize(); // Réduire la première fenêtre
  }

  // Get the primary screen's dimensions and scale factor
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize; // Pas de "scaleFactor" ici
  // const scaleFactor = primaryDisplay.scaleFactor;

  // Positionnement en bas au centre
  const xPos = (screenWidth - width) / 2;
  const yPos = screenHeight - height; // Collé en bas

  // Create the Electron window
  buttonInProgressWindow = new BrowserWindow({
    width,
    height,
    resizable: true,
    fullscreen: false,
    alwaysOnTop: true,
    transparent: true,
    frame: false, // Hide window borders (if needed)
    show: true,
    movable: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/index.js"),
      // enableRemoteModule: true,
    },
  });

  buttonInProgressWindow.setBounds({
    width,
    height,
    x: Math.round(xPos),
    y: Math.round(yPos),
  });

  // En production, charge le fichier HTML buildé

  if (process.env.NODE_ENV === "development") {
    buttonInProgressWindow.loadURL("http://localhost:5173/inprogress"); // Change the URL if needed
  } else {
    buttonInProgressWindow.loadFile(
      path.resolve(__dirname, "../renderer/inprogress.html")
    );
  }

  buttonInProgressWindow.on("closed", () => {
    buttonInProgressWindow = null;
  });
}

function createEditorWindow() {
  const MAIN_WINDOW_SIZE = { width: 900, height: 800 };
  editorWindow = new BrowserWindow({
    width: MAIN_WINDOW_SIZE.width,
    height: MAIN_WINDOW_SIZE.height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "../preload/index.js"),
      //  enableRemoteModule: true,
    },
  });

  editorWindow.minimize();

  editorWindow.on("resize", () => {
    editorWindow?.setSize(MAIN_WINDOW_SIZE.width, MAIN_WINDOW_SIZE.height);
  });

  // En développement, charge l'URL de dev de Vite
  if (process.env.NODE_ENV === "development") {
    editorWindow.loadURL("http://localhost:5173/editor");
    console.log("Loading development URL");
  } else {
    // En production, charge le fichier HTML buildé
    const htmlPath = path.resolve(__dirname, "../renderer/editor.html");
    console.log("Loading production path:", htmlPath);
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    editorWindow.loadFile(htmlPath).catch((err: any) => {
      console.error("Error loading file:", err);
    });
  }

  editorWindow.on("closed", () => {
    editorWindow = null;
  });
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: "hidden",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
    resizable: false,
    show: false,
    icon: path.join(__dirname, "../assets/icon-128.png"),
  });

  // Charge la page de configuration
  if (process.env.NODE_ENV === "development") {
    setupWindow.loadURL("http://localhost:5173/setup");
  } else {
    setupWindow.loadFile(path.resolve(__dirname, "../renderer/setup.html"));
  }

  setupWindow.once("ready-to-show", () => {
    setupWindow?.show();
  });

  setupWindow.on("closed", () => {
    setupWindow = null;
  });
}

// Fonction pour maintenir un buffer de captures récentes
async function updateCaptureBuffer() {
  if (!isRecording) return;

  try {
    const screenshot = await performCapture();
    if (screenshot) {
      captureBuffer = {
        screenshot,
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.error("Error updating capture buffer:", error);
  }
}

// Capture d'écran optimisée
async function performCapture() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = displays[0];
  const { width, height } = primaryDisplay.bounds;

  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: {
      width,
      height,
    },
  });

  return sources[0].thumbnail.toDataURL();
}

// Gérer le clic avec le buffer
async function handleClick(event: MouseEvent) {
  try {
    // Obtenir les infos de l'écran
    // Obtenir les infos de l'écran
    const x = event.x;
    const y = event.y;
    const displays = screen.getAllDisplays();
    const primaryDisplay = displays[0];

    // Récupérer l'élément cliqué de manière sécurisée
    let label = "";
    try {
      // Vérifier si event.target existe et si c'est un HTMLElement
      const clickedElement = event.target as HTMLElement;
      if (clickedElement && typeof clickedElement === "object") {
        // Vérifier que innerText ou textContent existent avant d'y accéder
        label =
          (clickedElement.innerText !== undefined
            ? clickedElement.innerText
            : "") ||
          (clickedElement.textContent !== undefined
            ? clickedElement.textContent
            : "") ||
          `Point (${x},${y})`;
      } else {
        label = `Point (${x},${y})`;
      }
    } catch (error) {
      console.warn(
        "Impossible de récupérer le texte de l'élément cliqué:",
        error
      );
      label = `Point (${x},${y})`;
    }
    // Pour les captures d'écran entier
    broadcastToAllWindows("click-captured", {
      x,
      y,
      absoluteX: x,
      absoluteY: y,
      displayBounds: primaryDisplay.bounds,
      screenshot: captureBuffer?.screenshot,
      timestamp: Date.now(),
      description: label,
    });
  } catch (error) {
    console.error("Error handling click:", error);
    broadcastToAllWindows("screen-capture-error", error);
  }
}

// Démarrer la mise à jour du buffer quand l'enregistrement commence
function startRecording() {
  isRecording = true;
  updateBufferInterval = setInterval(updateCaptureBuffer, CAPTURE_INTERVAL);
}

// Arrêter la mise à jour du buffer
function stopRecording() {
  isRecording = false;
  if (updateBufferInterval) {
    clearInterval(updateBufferInterval);
    updateBufferInterval = null;
  }
  captureBuffer = null;
}

async function getActiveSourceId(
  selectedPid: string | null
): Promise<string | null> {
  try {
    const activePid = await getActivePid();
    if (!activePid) {
      console.log("Pas de PID actif trouvé");
      return null;
    }

    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 1, height: 1 },
    });

    // Vérifier si selectedPid est un screen ou une window
    const selectedSource = sources.find(
      (source: { id: string | null }) => source.id === selectedPid
    );
    if (!selectedSource) return null;

    // Si selectedPid est un screen
    if (selectedSource.id.startsWith("screen:")) {
      return selectedPid; // Retourner directement le screen sélectionné
    }

    // Si selectedPid est une window, chercher la window active
    if (selectedSource.id.startsWith("window:")) {
      for (const source of sources) {
        if (!source.id.startsWith("window:")) continue;

        const windowPid = await getWindowPid(source.name);
        console.log(
          `Comparaison - Source: ${source.name}, PID: ${windowPid} vs Active: ${activePid}`
        );

        if (windowPid && Number(windowPid) === Number(activePid)) {
          return source.id;
        }
      }
    }

    // Si aucune correspondance trouvée, retourner le selectedPid
    return selectedPid;
  } catch (error) {
    console.error("Erreur getActiveSourceId:", error);
    return null;
  }
}

function updateRecordingState(newState: boolean) {
  isRecording = newState;
  // Notifier tous les listeners du changement
  broadcastToAllWindows("recording-state-changed", isRecording);
}

function checkAccessibilityPermission(): boolean {
  if (process.platform !== "darwin") return true;

  // Sur macOS, vérifier si l'application a les permissions d'accessibilité
  return systemPreferences.isTrustedAccessibilityClient(false);
}

// Fonction pour demander les permissions d'accessibilité
function requestAccessibilityPermission(): void {
  if (process.platform !== "darwin") return;

  dialog
    .showMessageBox({
      type: "info",
      title: "Permission d'accessibilité requise",
      message:
        "Cette application nécessite des permissions d'accessibilité pour fonctionner correctement.",
      detail:
        "Veuillez ouvrir les Préférences Système > Sécurité et confidentialité > Confidentialité > Accessibilité et ajouter cette application à la liste des applications autorisées.",
      buttons: ["Ouvrir les préférences", "Ignorer"],
    })
    .then(({ response }) => {
      if (response === 0) {
        // Ouvrir les préférences d'accessibilité
        shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        );
      }
    });
}

function initApp() {
  if (process.platform === "darwin") {
    const hasAccessibilityPermission = checkAccessibilityPermission();

    if (!hasAccessibilityPermission) {
      console.log("Permissions d'accessibilité non accordées");
      requestAccessibilityPermission();

      // Si l'accessibilité est requise, ne pas continuer
      return;
    }
  }

  createWindow();
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  uIOhook.on("mousedown", async (event: any) => {
    const activeWindow = await getActiveSourceId(selectedPid);

    if (!activeWindow) {
      console.log(
        "⛔ Clic ignoré - pas de fenêtre active",
        activeWindow,
        selectedPid
      );
      return;
    }
    if (activeWindow !== selectedPid) {
      console.log(
        `⛔ Clic ignoré - fenêtre différente: ${activeWindow} !== ${selectedPid}`
      );
      return;
    }

    const now = Date.now();
    if (now - lastClickTime < CLICK_THRESHOLD) {
      console.log("⏱️ Clic ignoré - trop rapproché");
      return;
    }
    lastClickTime = now;
    if (isRecording && mainWindow) {
      console.log("✅ Clic capturé et envoyé", { x: event.x, y: event.y });
      await handleClick(event);
    }
  });

  uIOhook.start();
}

function initSetup() {
  //resetSetup();

  if (isSetupCompleted() || isSetupCompleteFlag) {
    initApp();
    return;
  }

  createSetupWindow();
}

// Empêcher plusieurs instances de l'application
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const windows = require("electron").BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("activate", () => {
    const windows = require("electron").BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      initSetup();
    }
  });

  app.whenReady().then(() => {
    initSetup();
  });

  app.on("window-all-closed", () => {
    stopRecording();
    if (buttonInProgressWindow) {
      buttonInProgressWindow.close();
      buttonInProgressWindow = null;
    }

    if (editorWindow) {
      editorWindow.close();
      editorWindow = null;
    }
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

ipcMain.handle("start-recording", async () => {
  try {
    // Vérifier les permissions
    const hasPermission = await hasScreenCapturePermission();
    if (!hasPermission) {
      throw new Error("Screen recording permission not granted");
    }

    updateRecordingState(true);

    createWindowInProgressButtons();
    createEditorWindow();

    // Initialiser le buffer avec une première capture
    const initialCapture = await performCapture();
    if (initialCapture) {
      captureBuffer = {
        screenshot: initialCapture,
        timestamp: Date.now(),
      };
    }

    // Démarrer l'enregistrement
    startRecording();
    return true;
  } catch (error) {
    console.error("Error starting recording:", error);
    return false;
  }
});

// Gérer l'arrêt de l'enregistrement
ipcMain.handle("stop-recording", () => {
  updateRecordingState(false);
  isPaused = false;

  if (buttonInProgressWindow) {
    buttonInProgressWindow.close();
    buttonInProgressWindow = null;
  }
  if (mainWindow) mainWindow.restore();
  if (editorWindow) editorWindow.restore();

  return true;
});

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
ipcMain.handle("select-window", (_: any, pid: string) => {
  console.log("🖥️ Fenêtre sélectionnée :", pid);
  selectedPid = pid;
});

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
ipcMain.handle("GET_SOURCES", async (_: any, opts: any) => {
  const sources = await desktopCapturer.getSources(opts);

  // Obtenir les PIDs pour toutes les sources
  const sourcesWithPid = await Promise.all(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    sources.map(async (source: any) => {
      let pid = null;

      if (source.id.startsWith("window:")) {
        // Pour les fenêtres
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (win.getMediaSourceId() === source.id) {
            pid = win.webContents.getOSProcessId();
            break;
          }
        }

        // Si pas de PID trouvé via Electron, essayer via le système
        if (!pid) {
          pid = await getWindowPid(source.name);
        }
      } else if (source.id.startsWith("screen:")) {
        // Pour les écrans, on utilise le PID du processus de gestion d'affichage
        if (process.platform === "win32") {
          pid = await getWindowPid("dwm.exe"); // Display Window Manager sur Windows
        } else if (process.platform === "darwin") {
          pid = await getWindowPid("WindowServer"); // Window Server sur macOS
        } else {
          pid = await getWindowPid("Xorg"); // X Server sur Linux
        }
      }

      return {
        ...source,
        pid: pid,
      };
    })
  );

  return sourcesWithPid;
});

// IPC handler pour demander la permission
ipcMain.handle("request-permissions", async () => {
  requestScreenCaptureAccess();
  return checkScreenCapturePermission();
});

// IPC handler pour vérifier les permissions
ipcMain.handle("check-permissions", async () => {
  return await hasScreenCapturePermission();
});

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
ipcMain.on("toggle-pause", (_: any) => {
  isPaused = !isPaused;
  // Notifier tous les listeners du changement
  // mainWindow?.webContents.send("toggle-paused", isPaused);
  broadcastToAllWindows("toggle-paused", isPaused);
});

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
ipcMain.on("restart-recording", (_: any) => {
  // Notifier tous les listeners du changement
  // mainWindow?.webContents.send("restarted-recording", isPaused);
  broadcastToAllWindows("restarted-recording", isPaused);
});

async function handleAuthCallback() {
  if (!authWindow) return;
  const cookies = await authWindow?.webContents.session.cookies.get({});

  // Chercher le cookie next-auth.session-token
  const sessionCookie = cookies.find(
    (cookie: { name: string }) =>
      cookie.name === "next-auth.session-token" ||
      cookie.name === "__Secure-next-auth.session-token"
  );

  if (sessionCookie) {
    console.log("Session cookie found:", sessionCookie);

    // Sauvegarder le token
    const authData = {
      token: sessionCookie.value,
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      expires: new Date(sessionCookie?.expirationDate! * 1000).getTime(),
    };

    console.log(authData);
    store.setItem(NAME_STORE_AUTH, authData);
    authWindow?.close();
    return true;
  }
}

ipcMain.handle("auth:start", async () => {
  try {
    // Si une fenêtre d'authentification existe déjà, la fermer proprement
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.close();
      await new Promise((resolve) => setTimeout(resolve, 100)); // Petit délai pour la fermeture
    }

    // Recréer la fenêtre
    const AUTH_WINDOW_SIZE = { width: 1000, height: 800 };
    authWindow = new BrowserWindow({
      ...AUTH_WINDOW_SIZE,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
      frame: process.platform !== "darwin",
    });

    // Référence locale pour éviter des problèmes si authWindow devient null
    const currentAuthWindow = authWindow;

    // Configurer les écouteurs d'événements
    const navigateHandler = (_: any, url: string) => {
      if (currentAuthWindow && !currentAuthWindow.isDestroyed()) {
        console.log("Navigation to:", url);
        handleAuthCallback();
      }
    };

    const loadHandler = () => {
      if (currentAuthWindow && !currentAuthWindow.isDestroyed()) {
        handleAuthCallback();
        const currentURL = currentAuthWindow.webContents.getURL();
        console.log("Page loaded:", currentURL);
        // handleAuthCallback();
      }
    };

    // Attacher les écouteurs d'événements de manière sécurisée
    if (
      currentAuthWindow.webContents &&
      !currentAuthWindow.webContents.isDestroyed()
    ) {
      currentAuthWindow.webContents.on("will-navigate", navigateHandler);
      currentAuthWindow.webContents.on("did-navigate-in-page", navigateHandler);
      currentAuthWindow.webContents.on("did-finish-load", loadHandler);
    }

    authWindow.webContents.on("did-navigate", async (_, url) => {
      console.log("Navigation vers:", url);

      // Fermer la fenêtre si nous sommes sur une page autre que la page d'authentification
      if (!url.includes("/auth/signin")) {
        console.log("Page différente de auth/signin détectée");

        // Essayer de récupérer les cookies
        handleAuthCallback();

        // Fermer la fenêtre
        setTimeout(() => {
          if (authWindow && !authWindow.isDestroyed()) {
            authWindow.close();
            authWindow = null;

            // Notifier le reste de l'application
            BrowserWindow.getAllWindows().forEach((window) => {
              if (!window.isDestroyed()) {
                window.webContents.send("auth:success", {});
              }
            });
          }
        }, 500);
      }
    });

    // Gérer la fermeture de la fenêtre
    currentAuthWindow.on("closed", () => {
      if (authWindow === currentAuthWindow) {
        authWindow = null;
      }
    });

    // Charger l'URL de manière sécurisée
    if (currentAuthWindow && !currentAuthWindow.isDestroyed()) {
      const apiUrl = process.env.VITE_API_URL || "http://localhost:3001";

      try {
        await currentAuthWindow.loadURL(`${apiUrl}/auth/signin`);
      } catch (loadError) {
        console.warn(
          "Erreur lors du chargement de la page de connexion:",
          loadError
        );

        // Si l'erreur est due à une redirection (utilisateur déjà connecté)
        if (currentAuthWindow && !currentAuthWindow.isDestroyed()) {
          try {
            await currentAuthWindow.loadURL(`${apiUrl}/api/auth/session`);
          } catch (sessionError) {
            console.error(
              "Erreur lors du chargement de la page de session:",
              sessionError
            );
            // Si même la page de session échoue, on abandonne
            if (currentAuthWindow && !currentAuthWindow.isDestroyed()) {
              currentAuthWindow.close();
            }
            return false;
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Auth start error:", error);

    // Nettoyer les ressources
    if (authWindow && !authWindow.isDestroyed()) {
      try {
        authWindow.close();
      } catch (closeError) {
        console.warn(
          "Erreur lors de la fermeture de la fenêtre d'authentification:",
          closeError
        );
      }
      authWindow = null;
    }

    return false;
  }
});

ipcMain.handle("auth:check", () => {
  return store.getItem(NAME_STORE_AUTH);
});

ipcMain.handle("auth:logout", () => {
  store.removeItem(NAME_STORE_AUTH);
  return true;
});

// Gestionnaires d'événements IPC pour l'installation
ipcMain.handle("setup:check-permissions", async () => {
  return await checkAccessibilityPermission();
});

ipcMain.handle("setup:request-permission", async () => {
  /*  if (process.platform === "darwin" && permission === "screen") {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return await systemPreferences.askForMediaAccess(permission as any);
  } */
  if (process.platform === "darwin") {
    const hasAccessibilityPermission = checkAccessibilityPermission();

    if (!hasAccessibilityPermission) {
      console.log("Permissions d'accessibilité non accordées");
      requestAccessibilityPermission();

      // Si l'accessibilité est requise, ne pas continuer
      return false;
    }
  }
  return true;
});

ipcMain.handle("setup:create-directories", async () => {
  try {
    ensureAppDirectories();
    return true;
  } catch (error) {
    console.error("Error creating app directories:", error);
    return false;
  }
});

/* ipcMain.handle("setup:complete", async () => {
  try {
    // Enregistre la complétion de l'installation et la version actuelle
    store.setItem(SETUP_COMPLETED_KEY, true);
    store.setItem(APP_VERSION_KEY, app.getVersion());

    // Ferme la fenêtre de configuration
    if (setupWindow) {
      setupWindow.close();
      setupWindow = null;
    }

    // Démarre l'application principale
    initApp();
    return true;
  } catch (error) {
    console.error("Error completing setup:", error);
    return false;
  }
}); */

// Version améliorée de completeSetup pour l'environnement de production
ipcMain.handle("setup:complete", async () => {
  try {
    console.log("Début du processus de complétion de l'installation");

    // Enregistrer les informations d'installation
    store.setItem(SETUP_COMPLETED_KEY, true);
    store.setItem(APP_VERSION_KEY, app.getVersion());
    console.log("Informations d'installation enregistrées avec succès");

    // Au lieu de démarrer l'application principale directement,
    // utiliser app.relaunch() et app.exit() pour un redémarrage propre
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.webContents.send("setup:completing");

      // Attendre un peu pour que le message soit envoyé
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Afficher un dialogue de confirmation
      await dialog.showMessageBox(setupWindow, {
        type: "info",
        title: "Installation terminée",
        message: "L'installation a été complétée avec succès.",
        detail:
          "L'application va maintenant redémarrer pour appliquer les changements.",
        buttons: ["Redémarrer maintenant"],
      });

      // Redémarrer l'application
      console.log("Redémarrage de l'application...");
      app.relaunch({
        args: [
          ...process.argv.filter((arg) => arg !== SETUP_COMPLETE_FLAG),
          SETUP_COMPLETE_FLAG,
        ],
      });
      app.exit(0);
    } else {
      console.warn("Fenêtre d'installation non disponible, redémarrage direct");
      app.relaunch({
        args: [
          ...process.argv.filter((arg) => arg !== SETUP_COMPLETE_FLAG),
          SETUP_COMPLETE_FLAG,
        ],
      });
      app.exit(0);
    }

    return true;
  } catch (error) {
    console.error("Erreur lors de la complétion de l'installation:", error);

    // Tenter un redémarrage même en cas d'erreur
    try {
      app.relaunch({
        args: [
          ...process.argv.filter((arg) => arg !== SETUP_COMPLETE_FLAG),
          SETUP_COMPLETE_FLAG,
        ],
      });
      app.exit(1); // Code d'erreur différent
    } catch (relaunchError) {
      console.error("Échec du redémarrage d'urgence:", relaunchError);
    }

    return false;
  }
});

ipcMain.handle("shell:open-url", async (_, url) => {
  try {
    console.log(`Ouverture de l'URL: ${url}`);
    return await openInDefaultBrowser(url);
  } catch (error) {
    console.error("Erreur lors de l'ouverture de l'URL via commande:", error);
    throw error;
  }
});

// IPC handler pour la capture d'écran
//ipcMain.handle("capture-screen", captureScreen);
