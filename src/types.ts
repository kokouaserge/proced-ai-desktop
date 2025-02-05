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
  
  export interface Step {
    type: string;
    description: string;
    timestamp: string;
    screenshot?: string;
    elementSelector?: string;
    cursor?: CursorInfo;
  }