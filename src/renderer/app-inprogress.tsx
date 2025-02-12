import {
  StopCircle,
  MicOff,
  PlayCircle,
  PauseCircle,
  MoreVertical,
  RefreshCcw,
} from "lucide-react";
import { cn } from "./ui/cn";
import { useState } from "react";

export function App() {
  const [isPaused, setIsPaused] = useState(false);

  const restartRecording = () => {
    setIsPaused(false);
    window.electronAPI.restartRecording();
  };

  const stopRecording = () => {
    setIsPaused(false);
    window.electronAPI.stopRecording();
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    window.electronAPI.togglePause();
  };

  return (
    <div className="flex flex-row items-stretch bg-black dark:bg-black w-full h-full animate-in fade-in">
      <div className="flex flex-row justify-between p-[0.25rem] flex-1">
        <button
          className="py-[0.25rem] px-[0.5rem] text-red-300 dark:text-red-300 gap-[0.25rem] flex flex-row items-center rounded-lg"
          type="button"
          onClick={() => stopRecording()}
        >
          <StopCircle />
        </button>

        <div className="flex items-center gap-1">
          <div className="relative h-8 w-8 flex items-center justify-center">
            <MicOff className="size-5 text-gray-300 opacity-20 dark:text-gray-300 dark:opacity-100" />
          </div>

          <button
            className={cn(
              "p-[0.25rem] rounded-lg transition-colors",
              "text-gray-400",
              "h-8 w-8 flex items-center justify-center"
            )}
            type="button"
            onClick={() => togglePause()}
          >
            {isPaused ? <PlayCircle /> : <PauseCircle />}
          </button>

          <button
            className={cn(
              "p-[0.25rem] rounded-lg transition-colors",
              "text-gray-400",
              "h-8 w-8 flex items-center justify-center"
            )}
            type="button"
            onClick={() => restartRecording}
          >
            <RefreshCcw />
          </button>
        </div>
      </div>
      <div
        className="non-styled-move cursor-move flex items-center justify-center p-[0.25rem] border-l border-gray-400 dark:border-gray-200 hover:cursor-move"
        id="drgDrop"
      >
        <MoreVertical className="pointer-events-none text-gray-400 dark:text-gray-400" />
      </div>
    </div>
  );
}
