/**
 * Canonical IPC channel names shared between the Electron main process,
 * the preload bridge, and the injected renderer DRM layer. Keep this file
 * as the only place these strings are defined.
 */
export const IPC_CHANNELS = {
  /** Main -> Renderer: a DetectionEvent occurred (see types.ts). */
  DETECTION_EVENT: "drm:detection-event",
  /** Renderer/Tray -> Main: request to enable/disable OS content protection. */
  SET_PROTECTION: "drm:set-protection",
  /** Main -> Renderer: updated watermark payload to render. */
  UPDATE_WATERMARK: "drm:update-watermark",
  /** Main -> Renderer: blank/unblank data-drm protected elements. */
  BLANK_ELEMENTS: "drm:blank-elements",
  UNBLANK_ELEMENTS: "drm:unblank-elements",
  /** Renderer/Tray/Hotkey -> Main: toggle invisible mode. */
  TOGGLE_INVISIBLE: "drm:toggle-invisible",
  /** Main -> Renderer/Tray: current invisible mode state. */
  INVISIBLE_STATE: "drm:invisible-state",
  /** Main -> Renderer: the live config changed (dev mode hot reload). */
  CONFIG_UPDATED: "drm:config-updated",
  /** Renderer -> Main: ask for the current config snapshot. */
  GET_CONFIG: "drm:get-config",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
