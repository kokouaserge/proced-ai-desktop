import { useEffect, useRef, useState } from "react";
import { EditorHeader } from "./editor-header";
import { Step } from "../types";
import { StepsList } from "./step-list";

export function App() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [_, setIsRecording] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const lastClickRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  // Initialiser les écouteurs d'événements une seule fois au montage
  useEffect(() => {
    if (!window.electronAPI) {
      console.error("electronAPI non disponible");
      return;
    }

    console.log("Initialisation des écouteurs d'événements...");

    const checkAuth = async () => {
      const auth = await window.electronAPI.auth.check();
      if (auth) {
        return setIsAuthed(true);
      }
      return setIsAuthed(false);
    };
    checkAuth();

    // Écouter les événements d'authentification réussie
    const unsubscribeAuth = window.electronAPI.auth.onSuccess(() => {
      setIsAuthed(true);
    });

    // Écouteur pour le restart de l'enregistrement
    const removeRestartListener = window.electronAPI.onRecordingRestarted(
      (state: boolean) => {
        console.log("🔄 Redémarrage de l'enregistrement:", state);
        setSteps([]);
      }
    );

    // Écouteur pour les changements d'état d'enregistrement
    const removeRecordingListener = window.electronAPI.onRecordingStateChanged(
      (state: boolean) => {
        console.log("🎥 État d'enregistrement changé:", state);
        setIsRecording(state);
        if (!state) setIsPaused(false);
      }
    );

    // Écouteur pour les changements d'état de pause
    const removePauseListener = window.electronAPI.onPauseStateChanged(
      (state: boolean) => {
        console.log("⏸️ État de pause changé:", state);
        setIsPaused(state);
      }
    );

    // Écouteur pour les captures d'écran
    const removeCaptureListener = window.electronAPI.onScreenCapture(
      (event) => {
        console.log("📸 Capture d'écran reçue", event);
        if (isPaused) return;

        const now = Date.now();
        if (
          lastClickRef.current &&
          lastClickRef.current.x === event.x &&
          lastClickRef.current.y === event.y &&
          now - lastClickRef.current.time < 500 // CLICK_THRESHOLD
        ) {
          return;
        }

        lastClickRef.current = { x: event.x, y: event.y, time: now };

        const newStep: Step = {
          type: "click",
          description: `Click at ${event.label}`,
          timestamp: new Date().toISOString(),
          screenshot: event.screenshot,
          cursor: {
            absolute: { x: event?.absoluteX, y: event?.absoluteY },
            percentage: {
              x: (event.x / window.innerWidth) * 100,
              y: (event.y / window.innerHeight) * 100,
            },
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
        };

        setSteps((prev) => [...prev, newStep]);
      }
    );

    // Écouteur pour les erreurs de capture
    const removeErrorListener = window.electronAPI.onScreenCaptureError(
      (message) => {
        console.error("❌ Erreur de capture:", message);
        setIsPaused(false);
      }
    );

    // Nettoyage des écouteurs lors du démontage
    return () => {
      console.log("Nettoyage des écouteurs d'événements...");
      removeRestartListener();
      removeRecordingListener();
      removePauseListener();
      removeCaptureListener();
      removeErrorListener();
      unsubscribeAuth();
    };
  }, [isPaused]); // Dépendance à isPaused pour la gestion correcte des captures

  return (
    <div className="w-screen h-screen flex flex-col">
      <EditorHeader isAuthed={isAuthed} />
      <div
        className="p-5 pt-10 flex-1 w-full overflow-y-hidden flex flex-col gap-4 bg-gray-50 leading-5 animate-in fade-in"
        id="drgDrop"
      >
        <div className="rounded-2xl overflow-hidden shadow border flex-1 flex flex-col divide-y bg-white">
          <div className="flex flex-row flex-1 divide-x overflow-y-hidden">
            <StepsList steps={steps} setSteps={setSteps} />
          </div>
        </div>
      </div>
    </div>
  );
}
