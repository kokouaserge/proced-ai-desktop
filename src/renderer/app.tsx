import { useEffect, useState } from "react";
import { Logo } from "./ui/logo";
import { TargetSelects } from "./target-selects";
import { Camera, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { CameraSelect } from "./camera-select";
import { MicrophoneSelect } from "./microphone-select";

export function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSelectedScreen, setIsSelectedScreen] = useState(false);

  useEffect(() => {
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
      unsubscribeRecording?.();
      subscribePause?.();
    };
  }, [isPaused]);

  const startRecording = async () => {
    try {
      window.electronAPI?.startRecording();
      setIsSelectedScreen(false);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = () => {
    //  setIsRecording(false);
    setIsPaused(false);
    window.electronAPI?.stopRecording();
  };

  return (
    <div className="flex justify-center flex-col p-[1rem] gap-[0.75rem] text-[0.875rem] font-[400] bg-[--gray-50] h-full text-[--text-primary]  mt-6">
      <div className="flex items-center justify-between pb-[0.25rem]">
        <div className="flex items-center space-x-1">
          <div className="*:w-[92px] *:h-auto text-[--text-primary] ">
            <Logo className="dark:block hidden" />
            <Logo className="dark:hidden block" />
          </div>
          <p
            className={`text-[0.6rem] ${"bg-[--blue-400] text-white dark:text-white"} rounded-lg px-1.5 py-0.5`}
          >
            Pro
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={async () => {
              /*  if (!isAuthed) return await window.electronAPI.auth.start(); */
            }}
          >
            <Settings className="w-[1.25rem] h-[1.25rem] text-gray-400 hover:text-gray-500" />
          </button>
        </div>
      </div>

      <TargetSelects
        handleChangeTarget={(value) => {
          window.electronAPI.selectedWindow(value.id);
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
