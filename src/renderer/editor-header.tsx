import { useState } from "react";
import { cn } from "./ui/cn";
import { Button } from "./ui/button";

export function EditorHeader({ isAuthed }: { isAuthed: boolean }) {
  const [isWindows] = useState(navigator.platform.includes("Win"));
  return (
    <div
      id="drgDrop"
      className={cn(
        "flex flex-row justify-between items-center w-full cursor-default pr-5",
        isWindows ? "pl-[4.3rem]" : "pl-[1.25rem]"
      )}
    >
      <div className="flex flex-row items-center gap-[0.5rem] text-[0.875rem]" />
      <div className="flex flex-row gap-2 font-medium items-center">
        <div className="relative mt-4">
          <Button
            variant="primary"
            onClick={() => {
              if (isAuthed) console.log("enter");
              /*  trackEvent("export_button_clicked");
              setShowExportOptions(!showExportOptions()); */
            }}
          >
            Enregistrer l'enregistrement
          </Button>
        </div>
      </div>
    </div>
  );
}
