import { useEffect, useState } from "react";
import { SelectComponent } from "./ui/select";

export function TargetSelects({
  handleChangeTarget,
}: {
  handleChangeTarget: (value: { id: string }) => void;
}) {
  const [screens, setScreens] = useState<{ id: string; name: string }[]>([]);
  const [windows, setWindows] = useState<{ id: string; name: string }[]>([]);
  const [selectedSource, setSelectedSource] = useState<{
    id: string;
    name: string;
  }>();

  useEffect(() => {
    const getSources = async () => {
      try {
        // Get all window and screen sources
        const sources = await window.electronAPI.desktopCapturer({
          types: ["window", "screen"],
          thumbnailSize: { width: 300, height: 200 },
        });

        const onlyScreens = sources.filter((source: { id: string }) =>
          source.id.startsWith("screen")
        );
        const onlyWindows = sources.filter((source: { id: string }) =>
          source.id.startsWith("window")
        );
        setScreens(onlyScreens);
        setWindows(onlyWindows);
      } catch (err) {}
    };

    getSources();
  }, []);

  return (
    <div>
      <div
        className={`flex flex-row items-center rounded-[0.5rem] relative border h-8 transition-all duration-500 `}
        style={{
          transitionTimingFunction: "cubic-bezier(0.785, 0.135, 0.15, 0.86)",
        }}
      >
        <div
          className="w-1/2 absolute flex p-px inset-0 transition-transform peer-focus-visible:outline outline-2 outline-blue-300 outline-offset-2 rounded-[0.6rem] overflow-hidden"
          style={{
            transform:
              selectedSource && selectedSource.id.startsWith("window")
                ? "translateX(100%)"
                : undefined,
          }}
        >
          <div className="bg-gray-100 flex-1" />
        </div>

        <SelectComponent
          options={screens.map((screen) => ({
            label: screen.name,
            value: screen.id,
          }))}
          onChange={(id: string) => {
            const screen = screens.find((source) => source.id === id);
            if (!screen) return;

            setSelectedSource(screen);
             handleChangeTarget(screen);
          }}
          value={
            selectedSource?.id?.startsWith("screen") ? selectedSource?.id : ""
          }
          placeholder="Screen"
          emptyMessage="No screens found"
        />

        <SelectComponent
          onChange={(id: string) => {
            {
              const windowF = windows.find((source) => source.id === id);
              if (!windowF) return;
              setSelectedSource(windowF);
             handleChangeTarget(windowF);
            }
          }}
          options={windows.map((window) => ({
            label: window.name,
            value: window.id,
          }))}
          value={
            selectedSource?.id?.startsWith("window") ? selectedSource?.id : ""
          }
          placeholder="Window"
          emptyMessage="No windows found"
        />
      </div>
    </div>
  );
}
