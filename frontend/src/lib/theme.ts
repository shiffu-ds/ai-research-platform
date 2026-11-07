export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "arp.theme";

/**
 * Runs before first paint (inlined in <head>) so a saved light/dark choice
 * never flashes the wrong theme. "system" leaves the attribute off and
 * lets prefers-color-scheme decide.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function applyTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable */
  }
}
