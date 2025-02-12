// biome-ignore lint/style/useImportType: <explanation>
import React, { useEffect, useRef, useState } from "react";
import { StepItem } from "./step-item";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function StepsList({ steps, setSteps }: any) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastStepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (steps.length > 0) {
      // On attend un peu que l'image soit chargée avant de scroller
      const timer = setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [steps.length]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedItem === null || draggedItem === dropIndex) return;

    const newSteps = [...steps];
    const [draggedStep] = newSteps.splice(draggedItem, 1);
    newSteps.splice(dropIndex, 0, draggedStep);

    setSteps(newSteps);

    // Sync with background
    try {
      /* await chrome.runtime.sendMessage({
        action: "updateSteps",
        steps: newSteps,
      }) */;
    } catch (error) {
      console.error("Failed to sync steps with background:", error);
      // Optionally revert changes if sync fails
    }
  };

  const handleDelete = async (index: number) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const newSteps = steps.filter((_: any, i: number) => i !== index);
    setSteps(newSteps);

    /* try {
      await chrome.runtime.sendMessage({
        action: "updateSteps",
        steps: newSteps,
      });
    } catch (error) {
      console.error("Failed to sync steps deletion with background:", error);
    } */
  };

  const handleUpdateText = async (index: number, newText: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], description: newText };
    setSteps(newSteps);

  /*   try {
      await chrome.runtime.sendMessage({
        action: "updateSteps",
        steps: newSteps,
      });
    } catch (error) {
      console.error("Failed to sync text update with background:", error);
    } */
  };

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto px-4 pt-4 pb-48 space-y-3"
    >
      {/* biome-ignore lint/suspicious/noExplicitAny: <explanation> */}
      {steps.map((step: { timestamp: any; description: any; screenshot: any; type: any; cursor: any; }, index: number) => (
        <div
          key={`${step.timestamp}-${index}`}
          ref={index === steps.length - 1 ? lastStepRef : null}
        >
          <StepItem
            number={index + 1}
            text={step.description}
            imageUrl={step.screenshot}
            type={step.type}
            cursor={step.cursor}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDelete={handleDelete}
            onUpdateText={handleUpdateText}
            index={index}
            
          />
        </div>
      ))}
    </div>
  );
}
