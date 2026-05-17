import type { EditorActionDefinition, FieldDescriptor, OutputDescriptor } from "./actionCatalog.js";
import { en } from "./locales/en.js";
import { zhTw } from "./locales/zh-TW.js";
import type { ActionFieldTranslations, LocaleResources, UiStringKey } from "./locales/types.js";

export const supportedLocales = ["en", "zh-TW"] as const;

export type Locale = typeof supportedLocales[number];

export interface LocaleOption {
  locale: Locale;
  label: string;
}

export const resources: Record<Locale, LocaleResources> = {
  en,
  "zh-TW": zhTw,
};

export const localeOptions: LocaleOption[] = supportedLocales.map((locale) => ({
  locale,
  label: resources[locale].localeName,
}));

export function isLocale(value: string): value is Locale {
  return (supportedLocales as readonly string[]).includes(value);
}

export function createTranslator(locale: Locale): (key: UiStringKey, values?: Record<string, string | number>) => string {
  return (key, values = {}) => {
    const template = resources[locale].ui[key] ?? resources.en.ui[key] ?? key;
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
  };
}

export function localizeAction(action: EditorActionDefinition, locale: Locale): EditorActionDefinition {
  const localized = resources[locale].actions[action.type] ?? resources.en.actions[action.type];
  if (!localized) return action;
  return {
    ...action,
    label: localized.label,
    description: localized.description,
    inputFields: action.inputFields.map((field) => localizeField(field, localized.inputFields)),
    configFields: action.configFields.map((field) => localizeField(field, localized.configFields)),
    outputFields: action.outputFields.map((field) => localizeOutput(field, localized.outputFields)),
  };
}

export function localizeActions(actions: EditorActionDefinition[], locale: Locale): EditorActionDefinition[] {
  return actions.map((action) => localizeAction(action, locale));
}

function localizeField(field: FieldDescriptor, translations?: ActionFieldTranslations): FieldDescriptor {
  const translation = translations?.[field.name];
  if (!translation) return field;
  return {
    ...field,
    label: translation.label,
    placeholder: translation.placeholder ?? field.placeholder,
  };
}

function localizeOutput(field: OutputDescriptor, translations?: Record<string, { label: string }>): OutputDescriptor {
  const translation = translations?.[field.name];
  return translation ? { ...field, label: translation.label } : field;
}

export type { ActionTranslation, LocaleResources, UiStringKey } from "./locales/types.js";
