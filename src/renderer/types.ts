export interface Coordinates {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CursorInfo {
  absolute: Coordinates;
  percentage: Coordinates;
  viewport: ViewportSize;
}

export interface WindowContext {
  windowId: number;
  windowType?: string;
  tabId: number;
  tabTitle?: string;
  tabUrl?: string;
}

export interface BaseStep {
  type: string;
  description: string;
  timestamp: string;
  screenshot?: string;
  elementSelector?: string;
  context?: WindowContext;
}

export interface ClickStep extends BaseStep {
  type: "click";
  cursor: CursorInfo;
}

export interface InputStep extends BaseStep {
  type: "input";
}

export interface NavigationStep extends BaseStep {
  type: "navigation";
  url: string;
}

export interface ContextChangeStep extends BaseStep {
  type: "contextChange";
  url: string;
  context: WindowContext;
}

export type Step = ClickStep | InputStep | NavigationStep | ContextChangeStep;

export type StepItemProps = {
  number: number;
  text: string;
  imageUrl?: string | null;
  type: string;

  cursor: CursorInfo;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDelete: (index: number) => void;
  onUpdateText: (index: number, newText: string) => void;
  index: number;
};

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};
