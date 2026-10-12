import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { siteText, type SiteLocale } from "./siteText";
import { useTheme, type ThemeChoice } from "./theme";

/** One button that flips between the light and the dark page. */
export function ThemeButton({
  locale = "ko-kr",
  className = "theme-btn",
  size = 16,
}: {
  locale?: SiteLocale;
  className?: string;
  size?: number;
}): React.ReactElement {
  const t = siteText(locale);
  const { theme, setTheme } = useTheme();
  const label = theme === "dark" ? t.toLight : t.toDark;
  return (
    <button
      type="button"
      className={className}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" size={size} strokeWidth={1.8} />
      ) : (
        <Moon aria-hidden="true" size={size} strokeWidth={1.8} />
      )}
    </button>
  );
}

/** System, light or dark: the three-way switch in the footer. */
export function ThemeSwitch({
  locale = "ko-kr",
}: {
  locale?: SiteLocale;
}): React.ReactElement {
  const t = siteText(locale);
  const { choice, setTheme } = useTheme();
  const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] =
    [
      { value: "system", label: t.themeSystem, icon: <Monitor size={14} /> },
      { value: "light", label: t.themeLight, icon: <Sun size={14} /> },
      { value: "dark", label: t.themeDark, icon: <Moon size={14} /> },
    ];
  return (
    <div className="theme-switch" role="radiogroup" aria-label={t.theme}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={choice === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setTheme(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
