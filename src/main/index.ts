/* const {
  app,
  BrowserWindow,
  ipcMain,
  screen: screen,
  desktopCapturer,
  systemPreferences,
  nativeImage,
  shell,
} = require("electron"); */

import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  systemPreferences,
  nativeImage,
  screen,
} from "electron";
import path from "node:path";
import { uIOhook } from "uiohook-napi";
import { exec } from "node:child_process";
import { store } from "./store";

const NAME_STORE_AUTH = "proced_ai_auth";

let isRecording = false;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let mainWindow: any;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let buttonInProgressWindow: any = null;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let editorWindow: any = null;

let authWindow: any = null;

let lastClickTime = 0;

let selectedPid: string | null = null;

const CLICK_THRESHOLD = 500;

let isPaused = false;

let captureBuffer: any = null;
//let lastCaptureTime = 0;
let updateBufferInterval: any = null;
const CAPTURE_INTERVAL = 100; // ms
//const CAPTURE_BUFFER_SIZE = 5;

function broadcastToAllWindows(channel: string, ...args: any[]) {
  const windows = [
    mainWindow,
    editorWindow,
    buttonInProgressWindow,
    authWindow,
  ].filter((window) => window !== null);
  windows.forEach((window) => {
    window?.webContents?.send(channel, ...args);
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

  // Ouvrir les outils de développement
  // mainWindow.webContents.openDevTools();

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
  let width = 180 + 32; // Same as `let mut width = 180.0; width += 32.0;`
  let height = 40;

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
    editorWindow.setSize(MAIN_WINDOW_SIZE.width, MAIN_WINDOW_SIZE.height);
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

    const x = event.x;
    const y = event.y;
    const displays = screen.getAllDisplays();
    const primaryDisplay = displays[0];
    /*  
    const { scaleFactor } = primaryDisplay;

    // Obtenir la position réelle en tenant compte du scaling
    const x = Math.round(event.x / scaleFactor);
    const y = Math.round(event.y / scaleFactor); */

    /*     // Si une fenêtre spécifique est sélectionnée, ajuster les coordonnées
    if (selectedPid?.startsWith("window:")) {
      const activeWindow = BrowserWindow.getAllWindows().find(
        (win) => win.getMediaSourceId() === selectedPid
      );

      if (activeWindow) {
        const bounds = activeWindow.getBounds();
        // Ajuster les coordonnées relatives à la fenêtre
        const relativeX = x - bounds.x;
        const relativeY = y - bounds.y;

        broadcastToAllWindows("click-captured", {
          x: relativeX,
          y: relativeY,
          absoluteX: x,
          absoluteY: y,
          windowBounds: bounds,
          screenshot: captureBuffer?.screenshot,
          timestamp: Date.now(),
        });
        return;
      }
    } */

    const clickedElement = event.target as HTMLElement;

    // Si l'élément possède un label ou un texte à récupérer
    const label = clickedElement.innerText || clickedElement.textContent;
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

/* async function captureScreen() {
  try {
    if (!isRecording) return;
    const hasPermission = await hasScreenCapturePermission();
    if (!hasPermission) {
      const errorMessage =
        process.platform === "darwin"
          ? "Screen recording permission not granted. Please enable it in System Settings > Security & Privacy > Privacy > Screen Recording"
          : "Screen recording permission not granted. Please allow the application to record your screen.";

      throw new Error(errorMessage);
    }

    const displays = screen.getAllDisplays();
    const primaryDisplay = displays[0];
    const { width, height } = primaryDisplay.bounds;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: {
        width,
        height,
      },
    });

    // Pour Windows, gérer la barre de notification d'enregistrement
    if (process.platform === "win32" && mainWindow) {
      mainWindow.setAspectRatio(16 / 9);
      mainWindow.focus();
    }

    return sources[0].thumbnail.toDataURL();
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } catch (error: any) {
    console.error("Error capturing screen:", error);
    if (mainWindow) {
      mainWindow.webContents.send("screen-capture-error", error.message);
    }
    throw error;
  }
} */

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

// Attendre que l'app soit prête
app.whenReady().then(async () => {
  await createWindow();

  const hasPermission = await hasScreenCapturePermission();
  console.log("Initial screen capture permission:", hasPermission);

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

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Gérer le début de l'enregistrement
/* ipcMain.handle("start-recording", async () => {
  updateRecordingState(true);

  createWindowInProgressButtons();
  createEditorWindow();

  return true;
}); */

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
  const cookies = await authWindow.webContents.session.cookies.get({});

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
      expires: new Date(sessionCookie.expirationDate! * 1000).getTime(),
    };

    console.log(authData);
    store.setItem(NAME_STORE_AUTH, authData);
    authWindow?.close();
  }
}

ipcMain.handle("auth:start", async () => {
  try {
    const AUTH_WINDOW_SIZE = { width: 1000, height: 800 };
    authWindow = new BrowserWindow({
      ...AUTH_WINDOW_SIZE,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    authWindow?.webContents.on("will-navigate", (_: any, url: string) => {
      console.log("Navigation to:", url); // Pour debug
      handleAuthCallback();
    });

    authWindow?.webContents.on(
      "did-navigate-in-page",
      async (_: any, url: string) => {
        console.log("In-page navigation to:", url); // Pour debug
        handleAuthCallback();
      }
    );

    authWindow?.webContents.on("did-finish-load", () => {
      const currentURL = authWindow?.webContents.getURL();
      console.log("Page loaded:", currentURL); // Pour debug
      handleAuthCallback();
    });

    await authWindow.loadURL(`${process.env.VITE_API_URL}/auth/signin`);

    authWindow.webContents.openDevTools();

    authWindow.on("closed", () => {
      authWindow = null;
    });

    return true;
  } catch (error) {
    console.error("Auth start error:", error);
    throw error;
  }
});

ipcMain.handle("auth:check", () => {
  return store.getItem(NAME_STORE_AUTH);
});

ipcMain.handle("auth:logout", () => {
  store.removeItem(NAME_STORE_AUTH);
  return true;
});

// IPC handler pour la capture d'écran
//ipcMain.handle("capture-screen", captureScreen);
