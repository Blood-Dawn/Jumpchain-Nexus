/*
MIT License

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const DANGEROUS_TAG_SELECTOR = "script,style,iframe,object,embed,template,link,meta";
const EVENT_ATTRIBUTE_PATTERN = /^on/i;
const URI_ATTRIBUTE_NAMES = new Set(["href", "src", "xlink:href", "formaction"]);
const UNSAFE_URL_PATTERN = /^(?:javascript:|vbscript:|data:text\/html)/i;

function sanitizeWithDomParser(html: string): string | null {
  if (typeof window === "undefined" || typeof window.DOMParser !== "function") {
    return null;
  }

  try {
    const parser = new window.DOMParser();
    const document = parser.parseFromString(html, "text/html");
    const { body } = document;

    if (!body) {
      return "";
    }

    body.querySelectorAll(DANGEROUS_TAG_SELECTOR).forEach((node) => {
      node.remove();
    });

    body.querySelectorAll<HTMLElement>("*").forEach((element) => {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();

        if (EVENT_ATTRIBUTE_PATTERN.test(name)) {
          element.removeAttribute(attribute.name);
          continue;
        }

        if (URI_ATTRIBUTE_NAMES.has(name) && UNSAFE_URL_PATTERN.test(attribute.value.trim())) {
          element.removeAttribute(attribute.name);
        }
      }
    });

    return body.innerHTML;
  } catch (error) {
    return null;
  }
}

function sanitizeWithExpressions(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/<template[\s\S]*?>[\s\S]*?<\/template>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "")
    .replace(/\s(on\w+)=("[^"]*"|'[^']*'|`[^`]*`)/gi, "")
    .replace(
      /\s(?:href|src|xlink:href|formaction)=("|')?(?:javascript:|vbscript:|data:text\/html)[^"'>\s]*(?:\1)?/gi,
      ""
    );
}

export function sanitizeHtml(html: string): string {
  if (!html) {
    return "";
  }

  const sanitized = sanitizeWithDomParser(html);
  if (sanitized !== null) {
    return sanitized;
  }

  return sanitizeWithExpressions(html);
}

export default sanitizeHtml;
