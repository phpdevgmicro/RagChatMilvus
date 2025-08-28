import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    if (theme === "light") return "fas fa-sun";
    if (theme === "dark") return "fas fa-moon";
    return "fas fa-desktop";
  };

  const getTooltip = () => {
    if (theme === "light") return "Switch to dark mode";
    if (theme === "dark") return "Switch to system mode";
    return "Switch to light mode";
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-muted transition-colors"
      title={getTooltip()}
      data-testid="button-theme-toggle"
    >
      <i className={`${getIcon()} text-foreground text-sm`}></i>
    </button>
  );
}