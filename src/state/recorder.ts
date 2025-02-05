import type { Step } from "../types";
import { CLICK_THRESHOLD_MS } from "./constants";

class RecorderState {
  private static instance: RecorderState;
  private lastClickTime = 0;
  private _steps: Step[] = [];
  private _isRecording = false;
  private _isPaused = false;
  private listeners = new Set();

  private constructor() {}

  static getInstance(): RecorderState {
    if (!RecorderState.instance) {
      RecorderState.instance = new RecorderState();
    }
    return RecorderState.instance;
  }

  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  subscribe(listener: Function) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    // biome-ignore lint/complexity/noForEach: <explanation>
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    this.listeners.forEach((listener: any) => listener());
  }

  get steps(): Step[] {
    return this._steps;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get canRecordClick(): boolean {
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - this.lastClickTime;
    return timeSinceLastClick >= CLICK_THRESHOLD_MS;
  }

  setLastClickTime() {
    this.lastClickTime = Date.now();
  }

  addStep(step: Step) {
    this._steps = [...this._steps, step];
    this.notify();
  }

  startRecording() {
    this._isRecording = true;
    this._isPaused = false;
    this._steps = [];
    this.notify();
  }

  stopRecording() {
    this._isRecording = false;
    this._isPaused = false;
    this.notify();
  }

  togglePause() {
    this._isPaused = !this._isPaused;
    this.notify();
  }
}

export const recorderState = RecorderState.getInstance();
