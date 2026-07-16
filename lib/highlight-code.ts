import { codeToHtml } from "shiki";

const highlightCache = new Map<string, string>();

export const highlightCode = async (
  code: string,
  language = "tsx"
): Promise<string> => {
  const cacheKey = `${language}:${code}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const html = await codeToHtml(code, {
    lang: language,
    themes: {
      dark: "github-dark",
      light: "github-light",
    },
    transformers: [
      {
        code(node) {
          node.properties["data-line-numbers"] = "";
        },
        line(node) {
          node.properties["data-line"] = "";
        },
        pre(node) {
          node.properties.class =
            "min-w-max px-4 py-3.5 outline-none has-[[data-highlighted-line]]:px-0 has-[[data-line-numbers]]:px-0 has-[[data-slot=tabs]]:p-0 !bg-transparent";
        },
      },
    ],
  });

  highlightCache.set(cacheKey, html);
  return html;
};
