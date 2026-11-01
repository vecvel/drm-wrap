const IPC_CHANNELS = {
  DETECTION_EVENT: "drm:detection-event",
  SET_PROTECTION: "drm:set-protection",
  UPDATE_WATERMARK: "drm:update-watermark",
  BLANK_ELEMENTS: "drm:blank-elements",
  UNBLANK_ELEMENTS: "drm:unblank-elements",
  TOGGLE_INVISIBLE: "drm:toggle-invisible",
  INVISIBLE_STATE: "drm:invisible-state",
  CONFIG_UPDATED: "drm:config-updated",
  GET_CONFIG: "drm:get-config",
};

module.exports = { IPC_CHANNELS };
