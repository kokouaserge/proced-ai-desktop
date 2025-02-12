import { LocalStorage } from "node-localstorage";
import path from "node:path";
import { app } from "electron";

const localStorageI = new LocalStorage(
  path.join(app.getPath("userData"), "storage")
);

export const store = {
  setItem(key: string, value: any) {
    localStorageI.setItem(key, JSON.stringify(value));
  },

  getItem(key: string) {
    const item = localStorageI.getItem(key);
    return item ? JSON.parse(item) : null;
  },

  removeItem(key: string) {
    localStorageI.removeItem(key);
  },

  clear() {
    localStorageI.clear();
  },
};
