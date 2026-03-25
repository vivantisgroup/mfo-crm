/**
 * Preload script — runs in renderer context with Node access before page loads.
 * Exposes a safe, minimal IPC bridge for the CRM shell.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Platform info */
  platform: process.platform,
});
