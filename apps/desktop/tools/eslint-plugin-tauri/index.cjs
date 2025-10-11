const tauriGlobals = {
  __TAURI_IPC_OPTIONS__: 'readonly',
  __TAURI_METADATA__: 'readonly',
  __TAURI_METADATA_INTERNALS__: 'readonly',
  __TAURI_POST_MESSAGE__: 'readonly',
  __TAURI_REGISTER_CALLBACK__: 'readonly',
  __TAURI__: 'readonly',
};

module.exports = {
  configs: {
    recommended: {
      globals: tauriGlobals,
    },
  },
  environments: {
    tauri: {
      globals: tauriGlobals,
    },
  },
  rules: {},
};
