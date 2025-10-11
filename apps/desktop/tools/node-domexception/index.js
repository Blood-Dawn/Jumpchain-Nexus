class PolyfillDOMException extends Error {
  constructor(message = "", name = "Error") {
    super(message);
    this.name = name;
  }
}

const DOMExceptionImpl = typeof globalThis !== "undefined" && globalThis.DOMException ? globalThis.DOMException : PolyfillDOMException;

export const DOMException = DOMExceptionImpl;
export default DOMExceptionImpl;
