import sanitizeHtml from "sanitize-html";

export function sanitizeContentHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "h2", "h3", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { a: ["http", "https", "mailto"] },
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attributes) => ({ tagName: "a", attribs: { href: attributes.href ?? "", target: "_blank", rel: "noopener noreferrer nofollow" } })
    }
  }).trim();
}

export function plainTextToSafeHtml(value: string) {
  const escaped = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  return escaped.split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`).join("");
}
