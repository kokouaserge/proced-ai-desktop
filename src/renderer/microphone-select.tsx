import { cn } from "./ui/cn";
import { MicIcon } from "lucide-react";

export function MicrophoneSelect(props: {
  value: string;
  permissionGranted: boolean;
}) {
  return (
    <div className="flex flex-col gap-[0.25rem] items-stretch text-[--text-primary]">
      <label className="text-[--text-tertiary] text-[0.875rem]">Microphone</label>

      <div className="flex">
        <div className="w-full">
          <div className="flex flex-row items-center h-[2rem] px-[0.375rem] gap-[0.375rem] border rounded-lg border-gray-200 w-full disabled:text-gray-400 transition-colors KSelect">
            <MicIcon className="text-gray-400 size-[1.25rem]" />
            <span className="flex-1 text-left truncate">No Audio</span>
            <button
              type="button"
              className={cn(
                "px-[0.375rem] rounded-full text-[0.75rem]",
                props.value !== null && props.permissionGranted
                  ? "bg-blue-50 text-blue-300"
                  : "bg-red-50 text-red-300"
              )}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {!props.permissionGranted
                ? "Request Permission"
                : props.value !== null
                ? "On"
                : "Off"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
