import { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Monitor } from "lucide-react";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const ScreenSelector = ({ setSelectedWin }: { setSelectedWin: any }) => {
  const [sources, setSources] = useState([]);
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSources = async () => {
      try {
        // Get all window and screen sources
        const sources = await window.electronAPI.desktopCapturer({
          types: ["window"],
          thumbnailSize: { width: 300, height: 200 },
        });

        console.log("sources", sources);

        setSources(sources);
        setIsLoading(false);
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      } catch (err: any) {
        setError(`Erreur lors de la récupération des sources :${err.message}`);
        setIsLoading(false);
      }
    };

    getSources();
  }, []);

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const handleSourceSelect = async (source: any) => {
    setSelectedSource(source);
    setSelectedWin(source);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto h-screen flex flex-col">
      <h2 className="text-2xl font-bold mb-4">
        Sélectionnez une source à partager
      </h2>

      <div className="overflow-y-auto flex-1">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* biome-ignore lint/suspicious/noExplicitAny: <explanation> */}
          {sources.map((source: any) => (
            <Card
              key={source.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedSource?.id === source.id ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => handleSourceSelect(source)}
            >
              <CardContent className="p-3">
                <div className="relative">
                 {/*  {source.thumbnail ? (
                    <img
                      src={source.thumbnail.toDataURL()}
                      alt={source.name}
                      className="w-full h-32 object-cover rounded"
                    />
                  ) : ( */}
                    <div className="w-full h-32 bg-gray-100 flex items-center justify-center rounded">
                      <Monitor size={48} className="text-gray-400" />
                    </div>
                 {/*  )} */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b">
                    <p className="text-sm truncate">{source.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedSource && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="font-medium">
              Source sélectionnée : {selectedSource.name}
            </p>
            <p className="text-sm text-gray-600">
              Type :{" "}
              {selectedSource.id.includes("screen") ? "Écran" : "Fenêtre"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenSelector;
