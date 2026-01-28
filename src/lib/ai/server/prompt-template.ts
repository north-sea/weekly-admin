import 'server-only';

type TemplateVars = Record<string, string | number | null | undefined>;

const isTruthy = (value: TemplateVars[string]) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return String(value).trim().length > 0;
};

export function renderPromptTemplate(template: string, vars: TemplateVars): string {
  const withSections = template.replace(
    /{{#\s*([a-zA-Z0-9_]+)\s*}}([\s\S]*?){{\/\s*\1\s*}}/g,
    (_, key: string, content: string) => (isTruthy(vars[key]) ? content : '')
  );

  return withSections.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    const value = vars[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

