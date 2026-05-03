import { config } from "../config/appConfig";

const INTERFACE_KEY = config.storage.local.interfacePreferences;
const DEFAULT_THEME = config.storage.interfaceDefaults.theme;
const DEFAULT_LANGUAGE = config.storage.interfaceDefaults.language;

function getStoredInterfacePreferences() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INTERFACE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function storeInterfacePreferences(nextPreferences) {
  const preferences = {
    ...getStoredInterfacePreferences(),
    ...nextPreferences,
  };
  window.localStorage.setItem(INTERFACE_KEY, JSON.stringify(preferences));
  return preferences;
}

export function getStoredTheme() {
  const theme = getStoredInterfacePreferences().theme;
  return theme === "light" || theme === "dark" ? theme : DEFAULT_THEME;
}

export function storeTheme(theme) {
  storeInterfacePreferences({ theme });
  return theme;
}

export function getNextTheme(theme) {
  return theme === "light" ? "dark" : "light";
}

export function getStoredLanguage() {
  const language = getStoredInterfacePreferences().language;
  return language === "RU" || language === "EN" ? language : DEFAULT_LANGUAGE;
}

export function storeLanguage(language) {
  storeInterfacePreferences({ language });
  return language;
}

export function getNextLanguage(language) {
  return language === "RU" ? "EN" : "RU";
}
