import validationConfig from "../../config/validation.json";

export const config = {
  app: {
    project: {
      defaultName: import.meta.env.VITE_APP_NAME,
      defaultVersion: import.meta.env.VITE_APP_VERSION,
    },
    server: {
      frontendApiUrl: import.meta.env.VITE_API_URL,
    },
  },
  storage: {
    local: {
      authToken: import.meta.env.VITE_AUTH_TOKEN_KEY,
      interfacePreferences: import.meta.env.VITE_INTERFACE_PREFERENCES_KEY,
    },
    session: {
      sessionExpired: import.meta.env.VITE_SESSION_EXPIRED_KEY,
    },
    interfaceDefaults: {
      theme: import.meta.env.VITE_DEFAULT_THEME,
      language: import.meta.env.VITE_DEFAULT_LANGUAGE,
    },
  },
  validation: validationConfig,
};
