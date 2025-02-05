const {
  app,
  BrowserWindow,
  ipcMain,
  screen: screenA,
  desktopCapturer,
  systemPreferences,
} = require("electron");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { uIOhook, UiohookKey } = require("uiohook-napi");
const os = require("node:os");
const { exec } = require("node:child_process");

let isRecording = false;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let mainWindow: any;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let overlayWindow: any = null;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let controlsWindow: any = null;
let lastClickTime = 0;

let selectedPid: string | null = null;

const CLICK_THRESHOLD = 500;

// Variable pour stocker la position des contrôles
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let controlsPosition: any = null;

let isPaused = false;

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
    const hasPermission = await systemPreferences.askForMediaAccess("screen");
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
  mainWindow = new BrowserWindow({
    width: 750,
    height: 600,
    icon: path.join(__dirname, "../assets/icon-128.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "../preload/index.js"),
      enableRemoteModule: true,
    },
  });

  // Ouvrir les outils de développement
  mainWindow.webContents.openDevTools();

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

  mainWindow.webContents.on(
    "did-fail-load",
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (event: any, errorCode: any, errorDescription: any) => {
      console.log(event);
      console.error("Failed to load:", errorCode, errorDescription);
    }
  );

  // Pour Windows : gérer la notification système pour l'enregistrement d'écran
  mainWindow.on("focus", () => {
    if (process.platform === "win32") {
      mainWindow?.webContents.send("screen-capture-status", "active");
    }
  });
}

function createOverlayWindow() {
  const primaryDisplay = screenA.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  // Fenêtre transparente qui couvre tout l'écran
  overlayWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/overlay-preload.js"),
    },
    skipTaskbar: true,
    titleBarStyle: "hidden",
  });

  // Rendre la fenêtre transparente aux clics
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Charger une page HTML transparente
  if (process.env.NODE_ENV === "development") {
    overlayWindow.loadFile(path.join(__dirname, "../../src/overlay.html"));
  } else {
    overlayWindow.loadFile(path.join(__dirname, "./overlay.html"));
  }
}

function createControlsWindow() {
  const primaryDisplay = screenA.getPrimaryDisplay();
  const { width } = primaryDisplay.bounds;

  controlsWindow = new BrowserWindow({
    width: 200, // Largeur fixe pour les contrôles
    height: 100, // Hauteur fixe pour les contrôles
    x: width - 220, // Positionné en haut à droite
    y: 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
    skipTaskbar: true,
  });

  // Charger uniquement les contrôles
  if (process.env.NODE_ENV === "development") {
    controlsWindow.loadFile(path.join(__dirname, "../../src/controls.html"));
  } else {
    controlsWindow.loadFile(path.join(__dirname, "./controls.html"));
  }
}

async function handleClick(x: number, y: number) {
  try {
    const screenshot = await captureScreen();
    if (!screenshot) return; // Ajout de cette vérification
    // Vérifier que screenshot est une chaîne ou le convertir si nécessaire
    const screenshotData =
      typeof screenshot === "string" ? screenshot : screenshot.toString();
    mainWindow?.webContents.send("click-captured", {
      x,
      y,
      screenshot: screenshotData,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error handling click:", error);
    mainWindow?.webContents.send("screen-capture-error", error);
  }
}

async function captureScreen() {
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

    //const { width, height } = screenA;

    const displays = screenA.getAllDisplays();
    const primaryDisplay = displays[0];
    const { width, height } = primaryDisplay.bounds;

    await new Promise((resolve) => setTimeout(resolve, 200));

    const sources = await desktopCapturer.getSources({
      types: ["window"],
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
}

async function getActiveSourceId(): Promise<string | null> {
  try {
    const activePid = await getActivePid();
    if (!activePid) {
      console.log("Pas de PID actif trouvé");
      return null;
    }

    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 1, height: 1 },
    });

    console.log(
      "Sources disponibles:",
      sources.map((s: { id: number; name: string }) => ({
        id: s.id,
        name: s.name,
      }))
    );
    console.log("PID actif:", activePid);

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

    return sources[0]?.id || null; // Fallback sur la première source si pas de correspondance
  } catch (error) {
    console.error("Erreur getActiveSourceId:", error);
    return null;
  }
}

function updateRecordingState(newState: boolean) {
  isRecording = newState;
  // Notifier tous les listeners du changement
  mainWindow?.webContents.send("recording-state-changed", isRecording);
}

// Attendre que l'app soit prête
app.whenReady().then(async () => {
  await createWindow();
  const hasPermission = await hasScreenCapturePermission();
  console.log("Initial screen capture permission:", hasPermission);

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  uIOhook.on("mousedown", async (event: any) => {
    const activeWindow = await getActiveSourceId();

    if (!activeWindow) {
      console.log("⛔ Clic ignoré - pas de fenêtre active");
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
      await handleClick(event.x, event.y);
    }
  });

  uIOhook.start();
});

app.on("window-all-closed", () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  if (controlsWindow) {
    controlsWindow.close();
    controlsWindow = null;
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
ipcMain.handle("start-recording", async () => {
  updateRecordingState(true);
  if (!overlayWindow) {
    createOverlayWindow();
  }
  if (!controlsWindow) {
    createControlsWindow();
  }

  return true;
});

// Gérer l'arrêt de l'enregistrement
ipcMain.handle("stop-recording", () => {
  updateRecordingState(false);
  isPaused = false;
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  if (controlsWindow) {
    controlsWindow.close();
    controlsWindow = null;
  }
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

// Gérer la position des contrôles
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
ipcMain.on("set-controls-position", (_: any, position: any) => {
  console.log("updated", position);
  controlsPosition = position;
});

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
ipcMain.on("toggle-pause", (_: any) => {
  isPaused = !isPaused;
  // Notifier tous les listeners du changement
  mainWindow?.webContents.send("toggle-paused", isPaused);
});

// IPC handler pour la capture d'écran
//ipcMain.handle("capture-screen", captureScreen);
