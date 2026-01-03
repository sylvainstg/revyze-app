import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="relative group">
      <button className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
        <Globe className="w-4 h-4" />
        <span className="uppercase">{i18n.language.split("-")[0]}</span>
      </button>

      <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button
          onClick={() => changeLanguage("en")}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${i18n.language.startsWith("en") ? "text-indigo-600 font-semibold" : "text-slate-600"}`}
        >
          English
        </button>
        <button
          onClick={() => changeLanguage("fr")}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${i18n.language.startsWith("fr") ? "text-indigo-600 font-semibold" : "text-slate-600"}`}
        >
          Français
        </button>
      </div>
    </div>
  );
};
