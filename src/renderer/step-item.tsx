// biome-ignore lint/style/useImportType: <explanation>
import React, { useEffect, useRef, useState } from "react";
import type { StepItemProps } from "./types";
import { Grip, Trash2, Check, X } from "lucide-react";

export const StepItem = ({
  number,
  text,
  imageUrl = null,
  type,
  cursor,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDelete,
  onUpdateText,
  index,
}: StepItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isEditing && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.style.height = "auto";
      textInputRef.current.style.height = `${textInputRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    setIsEditing(true);
    setEditedText(text);
  };

  const handleSaveEdit = () => {
    onUpdateText(index, editedText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(text);
    setIsEditing(false);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) =>
        isEditing ? e.preventDefault() : onDragStart(e, index)
      }
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className=" p-4 bg-white rounded-xl shadow-sm mb-3 group hover:shadow-md transition-shadow duration-200 relative"
    >
      <div className="flex items-start space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0 group cursor-move">
            <span className="group-hover:hidden">{number}</span>
            <Grip className="w-4 h-4 text-blue-600 hidden group-hover:block transition-all duration-200" />
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textInputRef}
                value={editedText}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[24px] resize-none"
                rows={1}
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex items-center space-x-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 text-sm"
                >
                  <Check className="w-3 h-3" />
                  <span>Enregistrer</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center space-x-1 px-2 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 text-sm"
                >
                  <X className="w-3 h-3" />
                  <span>Annuler</span>
                </button>
              </div>
            </div>
          ) : (
            // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
            <p
              onClick={handleStartEditing}
              className="text-gray-800 cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-md"
            >
              {text}
            </p>
          )}
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-4 right-4 p-1 hover:bg-red-50 rounded-md"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
      <div className="mt-2 mr-2">
        {imageUrl && (
          <div className="space-y-2 overflow-hidden w-full rounded-lg shadow-lg border-2 bg-indigo-600">
            {/* Image principale */}
            <div
              className=" w-full overflow-hidden rounded-lg shadow-lg border-2 bg-indigo-600"
              style={{
                transform: "scale(2)",
                transformOrigin: `${cursor.percentage.x}% ${cursor.percentage.y}%`, // Point d'origine du zoom
              }}
            >
              <img
                ref={imageRef}
                className="w-full rounded  transition-all duration-200  h-auto block"
                src={imageUrl}
                alt={`Step ${number} screenshot`}
              />

              {/* Point de clic sur l'image principale */}
              {type === "click" && cursor && (
                <div
                  className="absolute w-4 h-4 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-50"
                  style={{
                    left: `${cursor.percentage.x}%`,
                    top: `${cursor.percentage.y}%`,
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
