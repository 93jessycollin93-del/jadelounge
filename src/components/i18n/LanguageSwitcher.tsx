import { Globe, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/i18n";

interface Props {
  variant?: "icon" | "full";
}

export function LanguageSwitcher({ variant = "icon" }: Props) {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === current) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("common.language")}>
            <Globe className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Globe className="h-4 w-4" />
            <span>{currentLang.flag} {currentLang.label}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 max-h-80 overflow-auto">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onClick={() => i18n.changeLanguage(lng.code)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>{lng.flag}</span>
              <span>{lng.label}</span>
            </span>
            {current === lng.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}