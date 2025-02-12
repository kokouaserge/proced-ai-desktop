import { useEffect, useRef, useState } from "react";
/* import { Pause, Eye, Trash2, Check, Play } from "lucide-react"; */
import type { Step } from "../types";
/* import { StepsList } from "./step-list";
import ScreenSelector from "./screen-selector";
import { Tooltip } from "@kobalte/core"; */
import { Logo } from "./ui/logo";
import { TargetSelects } from "./target-selects";
import { Camera, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { CameraSelect } from "./camera-select";
import { MicrophoneSelect } from "./microphone-select";

const CLICK_THRESHOLD = 1000;

export function App() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isWindows] = useState(navigator.platform.includes("Win"));
  const [isSelectedScreen, setIsSelectedScreen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const lastClickRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  useEffect(() => {
    console.log(window.electronAPI);
  }, []);

  useEffect(() => {
    // Vérifier les permissions au chargement
    checkPermissions();

    console.log(window.electronAPI);

    const checkAuth = async () => {
      const auth = await window.electronAPI?.auth.check();
      if (auth) {
        setIsAuthed(true);
      }
    };
    checkAuth();

    // Écouter les événements d'authentification réussie
    const unsubscribeAuth = window.electronAPI?.auth.onSuccess(() => {
      setIsAuthed(true);
    });

    const unsubscribeRestart = window.electronAPI?.onRecordingRestarted(
      (state: boolean | ((prevState: boolean) => boolean)) => {
        console.log("Restart changé:", state);
        setSteps([]);
      }
    );

    // Écouter les changements d'état d'enregistrement
    const unsubscribeRecording = window.electronAPI?.onRecordingStateChanged(
      (state: boolean | ((prevState: boolean) => boolean)) => {
        console.log("État enregistrement changé:", state);
        setIsRecording(state);
        if (!state) setIsPaused(false);
      }
    );

    const subscribePause = window.electronAPI?.onPauseStateChanged(
      (state: boolean | ((prevState: boolean) => boolean)) => {
        console.log("État Pause changé:", state);
        setIsPaused(state);
      }
    );

    // Ignorer les événements si en pause
    if (isPaused) return;

    const captureSubscribe = window.electronAPI?.onScreenCapture(
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
    const captureError = window.electronAPI?.onScreenCaptureError(
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      (message: any) => {
        console.log(message);
        setIsRecording(false);
        setIsPaused(false);
      }
    );

    return () => {
      captureError?.();
      captureSubscribe?.();
      unsubscribeRecording?.();
      subscribePause?.();
      unsubscribeRestart?.();
      unsubscribeAuth?.();
    };
  }, [isPaused]);

  const checkPermissions = async () => {
    const permitted = await window.electronAPI?.checkPermissions();
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
  const startRecording = async () => {
    //  if (!value) return setIsSelectedScreen(true);
    try {
      if (!hasPermissions && !isWindows) {
        const message =
          "Please grant screen recording permission in your system settings.";
        // setError(message);
        console.log(message);
        return await requestPermissions();
      }
      window.electronAPI?.startRecording();
      // setIsRecording(true);
      setIsSelectedScreen(false);
      setSteps([]);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = () => {
    //  setIsRecording(false);
    setIsPaused(false);
    window.electronAPI?.stopRecording();
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="flex justify-center flex-col p-[1rem] gap-[0.75rem] text-[0.875rem] font-[400] bg-[--gray-50] h-full text-[--text-primary]  mt-6">
      <div className="flex items-center justify-between pb-[0.25rem]">
        <div className="flex items-center space-x-1">
          <div className="*:w-[92px] *:h-auto text-[--text-primary] ">
            <Logo className="dark:block hidden" />
            <Logo className="dark:hidden block" />
          </div>
          <button
            type="button"
            onClick={async () => {
              startRecording();

              if (isRecording) stopRecording();

              if (isSelectedScreen) togglePause();

              if (steps) return;
            }}
            className={`text-[0.6rem] ${"bg-[--blue-400] text-white dark:text-white"} rounded-lg px-1.5 py-0.5`}
          >
            Pro
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={async () => {
              if (!isAuthed) return await window.electronAPI.auth.start();
              // if (!isAuthed) return await window.electronAPI.auth.start();

              //  await window.electronAPI.auth.logout();
            }}
          >
            <Settings className="w-[1.25rem] h-[1.25rem] text-gray-400 hover:text-gray-500" />
          </button>
        </div>
      </div>

      <TargetSelects
        handleChangeTarget={(value) => {
          window.electronAPI.selectedWindow(value.id),
            setIsSelectedScreen(true);
        }}
      />

      <CameraSelect permissionGranted={false} value="" />

      <MicrophoneSelect permissionGranted={false} value="" />

      <div className="w-full flex items-center space-x-1">
        <Button
          variant={isRecording ? "destructive" : "primary"}
          size="md"
          onClick={() => {
            if (isRecording) return stopRecording();
            startRecording();
          }}
          className="flex-grow  "
          disabled={!isSelectedScreen}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </Button>
        <Button
          disabled={isRecording}
          variant="primary"
          size="md"
          onClick={() => console.log("log")}
        >
          <Camera className="w-[1rem] h-[1rem]" />
        </Button>
      </div>
    </div>
  );
}
