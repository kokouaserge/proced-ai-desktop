import { useState } from "react";
import { cn } from "./ui/cn";
import { Button } from "./ui/button";
import type { Step } from "../types";

export function EditorHeader({
  isAuthed,
  token,
  steps,
}: {
  isAuthed: boolean;
  token: string;
  steps: Step[];
}) {
  const [isWindows] = useState(navigator.platform.includes("Win"));
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
            disabled={isLoading}
            onClick={async () => {
              if (isAuthed) {
                setIsLoading(true);
                console.log(token);
                const domain = "http://localhost:3001/"; //https://app.proced.ai

                try {
                  const response = await fetch(domain + "api/new-document", {
                    method: "POST",
                    body: JSON.stringify({ name: "Desktop", steps }),
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                  });

                  const result = await response.json();
                  await window.electronAPI.openInDefaultBrowser(
                    `${domain}${result.url}`
                  );
                  setIsLoading(false);
                } catch (err) {
                  console.log(err);
                }
              }
            }}
          >
            {isLoading ? "Chargement..." : "Enregistrer l'enregistrement"}
          </Button>
        </div>
      </div>
    </div>
  );
}
