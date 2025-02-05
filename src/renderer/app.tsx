import { useEffect, useRef, useState } from "react";
import { Pause, Eye, Trash2, Check, Play } from "lucide-react";
import type { Step } from "../types";
import { StepsList } from "./step-list";
import ScreenSelector from "./screen-selector";

const CLICK_THRESHOLD = 1000;

export function App() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isWindows] = useState(navigator.platform.includes("Win"));
  const [isSelectedScreen, setIsSelectedScreen] = useState(false);

  const lastClickRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  useEffect(() => {
    // Vérifier les permissions au chargement
    checkPermissions();

    // Ignorer les événements si en pause
    if (isPaused) return;

    // Écouter les changements d'état d'enregistrement
    const unsubscribeRecording = window.electronAPI.onRecordingStateChanged(
      (state: boolean | ((prevState: boolean) => boolean)) => {
        console.log("État enregistrement changé:", state);
        setIsRecording(state);
        if (!state) setIsPaused(false);
      }
    );

    const subscribePause = window.electronAPI.onPauseStateChanged(
      (state: boolean | ((prevState: boolean) => boolean)) => {
        console.log("État Pause changé:", state);
        setIsPaused(state);
      }
    );

    const captureSubscribe = window.electronAPI.onScreenCapture(
      async (event) => {
        console.log(event);
        const cursorPosition = {
          x: event.x,
          y: event.y,
        };

        try {
          const screenshot = event.screenshot;
          if (screenshot) {
            // Vérifier si le dernier step est différent
            const now = Date.now();
            if (
              lastClickRef.current &&
              lastClickRef.current?.x === event.x &&
              lastClickRef.current?.y === event.y &&
              now - new Date(lastClickRef.current?.time).getTime() <
                CLICK_THRESHOLD
            ) {
              return; // Ignorer si même coordonnées que le dernier click
            }

            lastClickRef.current = { x: event.x, y: event.y, time: now };
            const newStep: Step = {
              type: "click",
              description: `Click at (${cursorPosition.x}, ${cursorPosition.y})`,
              timestamp: new Date().toISOString(),
              screenshot,
              cursor: {
                absolute: cursorPosition,
                percentage: {
                  x: (event.x / window.screen.width) * 100,
                  y: (event.y / window.screen.height) * 100,
                },
                viewport: {
                  width: window.screen.width,
                  height: window.screen.height,
                },
              },
            };

            setSteps((prev) => [...prev, newStep]);
          }
        } catch (error) {
          console.error("Failed to capture screen:", error);
        }
      }
    );

    // Écouter les erreurs de capture d'écran
    const captureError = window.electronAPI.onScreenCaptureError(
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      (message: any) => {
        console.log(message);
        setIsRecording(false);
        setIsPaused(false);
      }
    );

    return () => {
      captureError();
      captureSubscribe();
      unsubscribeRecording();
      subscribePause();
    };
  }, [isPaused]);

  const checkPermissions = async () => {
    const permitted = await window.electronAPI.checkPermissions();
    setHasPermissions(permitted);
  };

  const requestPermissions = async () => {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await (window.electronAPI as any)?.requestPermissions();
      await checkPermissions();
    } catch (error) {
      console.error("Failed to request permissions:", error);
    }
  };
  const startRecording = async (value = "") => {
    if (!value) return setIsSelectedScreen(true);

    try {
      if (!hasPermissions && !isWindows) {
        const message =
          "Please grant screen recording permission in your system settings.";
        // setError(message);
        console.log(message);
        return await requestPermissions();
      }
      await window.electronAPI.startRecording();
      setIsRecording(true);
      setIsSelectedScreen(false);
      setSteps([]);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    window.electronAPI.stopRecording();
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="min-w-[320px] max-w-md w-auto h-screen bg-gray-50 flex flex-col fixed inset-0 overflow-hidden">
      {/*  <SyncAuth> */}
      <div className="overflow-y-auto flex-1">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="space-y-2 mb-2">
            <div className="flex justify-center">
              <img
                src="https://app.proced.ai/images/logo/logo.svg"
                alt="logo"
                className="w-auto h-auto"
              />
            </div>
          </div>

          {/* Start Recording Button */}
          <div className="space-y-2 p-4">
            {!isRecording && !isSelectedScreen && (
              <button
                type="button"
                onClick={() => setIsSelectedScreen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                <span className="font-medium">Demarrer l'enregistrement</span>
              </button>
            )}

            {!isRecording && isSelectedScreen && (
              <div>
                <ScreenSelector
                  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                  setSelectedWin={async (value: any) => {
                    console.log("source", value);
                    await Promise.all([
                      window.electronAPI.selectedWindow(value.id),
                      startRecording(value.id),
                    ]);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Steps List - Add padding bottom to prevent content being hidden behind control panel */}
        <StepsList steps={steps} setSteps={setSteps} />

        {/* Fixed Control Panel */}
        {isRecording && (
          <div className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 shadow-lg">
            <div className="p-4 space-y-3">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={togglePause}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Reprendre</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Pause</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4" />
                  <span>Blur</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                    PRO
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => stopRecording()}
                  className="flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => stopRecording()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                <span className="font-medium">Arreter l'enregistrement</span>
              </button>
            </div>
          </div>
        )}
      </div>
      {/* </SyncAuth> */}
    </div>
  );
}
