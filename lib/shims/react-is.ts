// Minimal vendored `react-is` implementation (MIT) to avoid build/runtime failures
// when `react-is` is missing due to incomplete installs or peer-deps pruning.
//
// We alias `react-is` -> this file via `next.config.ts` for both Turbopack and Webpack.

/* eslint-disable @typescript-eslint/no-explicit-any */

const REACT_ELEMENT_TYPE = Symbol.for("react.element");
// React 19 may use a transitional element symbol in some builds.
const REACT_TRANSITIONAL_ELEMENT_TYPE = Symbol.for("react.transitional.element");
const REACT_PORTAL_TYPE = Symbol.for("react.portal");
const REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
const REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
const REACT_PROFILER_TYPE = Symbol.for("react.profiler");
const REACT_PROVIDER_TYPE = Symbol.for("react.provider");
const REACT_CONTEXT_TYPE = Symbol.for("react.context");
const REACT_SERVER_CONTEXT_TYPE = Symbol.for("react.server_context");
const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
const REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
const REACT_MEMO_TYPE = Symbol.for("react.memo");
const REACT_LAZY_TYPE = Symbol.for("react.lazy");
const REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
const REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");

function isElementLike(object: any): boolean {
  if (typeof object !== "object" || object === null) return false;
  const tag = object.$$typeof;
  return tag === REACT_ELEMENT_TYPE || tag === REACT_TRANSITIONAL_ELEMENT_TYPE;
}

export function isValidElementType(type: any): boolean {
  if (typeof type === "string" || typeof type === "function") return true;

  if (
    type === REACT_FRAGMENT_TYPE ||
    type === REACT_PROFILER_TYPE ||
    type === REACT_STRICT_MODE_TYPE ||
    type === REACT_SUSPENSE_TYPE ||
    type === REACT_SUSPENSE_LIST_TYPE ||
    type === REACT_OFFSCREEN_TYPE
  ) {
    return true;
  }

  if (typeof type === "object" && type !== null) {
    const $$typeof = type.$$typeof;
    if (
      $$typeof === REACT_LAZY_TYPE ||
      $$typeof === REACT_MEMO_TYPE ||
      $$typeof === REACT_PROVIDER_TYPE ||
      $$typeof === REACT_CONTEXT_TYPE ||
      $$typeof === REACT_FORWARD_REF_TYPE ||
      $$typeof === REACT_MODULE_REFERENCE ||
      type.getModuleId !== undefined
    ) {
      return true;
    }
  }

  return false;
}

export function typeOf(object: any): symbol | undefined {
  if (typeof object === "object" && object !== null) {
    const $$typeof = object.$$typeof;
    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
      case REACT_TRANSITIONAL_ELEMENT_TYPE: {
        const type = object.type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
          case REACT_SUSPENSE_TYPE:
          case REACT_SUSPENSE_LIST_TYPE:
            return type;
          default: {
            const $$typeofType = type && type.$$typeof;
            switch ($$typeofType) {
              case REACT_SERVER_CONTEXT_TYPE:
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_LAZY_TYPE:
              case REACT_MEMO_TYPE:
              case REACT_PROVIDER_TYPE:
                return $$typeofType;
              default:
                return $$typeof as symbol;
            }
          }
        }
      }
      case REACT_PORTAL_TYPE:
        return $$typeof as symbol;
      default:
        break;
    }
  }
  return undefined;
}

export const ContextConsumer = REACT_CONTEXT_TYPE;
export const ContextProvider = REACT_PROVIDER_TYPE;
export const Element = REACT_ELEMENT_TYPE;
export const ForwardRef = REACT_FORWARD_REF_TYPE;
export const Fragment = REACT_FRAGMENT_TYPE;
export const Lazy = REACT_LAZY_TYPE;
export const Memo = REACT_MEMO_TYPE;
export const Portal = REACT_PORTAL_TYPE;
export const Profiler = REACT_PROFILER_TYPE;
export const StrictMode = REACT_STRICT_MODE_TYPE;
export const Suspense = REACT_SUSPENSE_TYPE;
export const SuspenseList = REACT_SUSPENSE_LIST_TYPE;

export function isContextConsumer(object: any): boolean {
  return typeOf(object) === REACT_CONTEXT_TYPE;
}

export function isContextProvider(object: any): boolean {
  return typeOf(object) === REACT_PROVIDER_TYPE;
}

export function isElement(object: any): boolean {
  return isElementLike(object);
}

export function isForwardRef(object: any): boolean {
  return typeOf(object) === REACT_FORWARD_REF_TYPE;
}

export function isFragment(object: any): boolean {
  return typeOf(object) === REACT_FRAGMENT_TYPE;
}

export function isLazy(object: any): boolean {
  return typeOf(object) === REACT_LAZY_TYPE;
}

export function isMemo(object: any): boolean {
  return typeOf(object) === REACT_MEMO_TYPE;
}

export function isPortal(object: any): boolean {
  return typeOf(object) === REACT_PORTAL_TYPE;
}

export function isProfiler(object: any): boolean {
  return typeOf(object) === REACT_PROFILER_TYPE;
}

export function isStrictMode(object: any): boolean {
  return typeOf(object) === REACT_STRICT_MODE_TYPE;
}

export function isSuspense(object: any): boolean {
  return typeOf(object) === REACT_SUSPENSE_TYPE;
}

export function isSuspenseList(object: any): boolean {
  return typeOf(object) === REACT_SUSPENSE_LIST_TYPE;
}

// Deprecated aliases kept for compatibility.
export function isAsyncMode(): boolean {
  return false;
}

export function isConcurrentMode(): boolean {
  return false;
}
