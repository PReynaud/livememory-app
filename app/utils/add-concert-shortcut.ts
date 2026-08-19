export type AddConcertKeydownLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
};

type TypingTarget = {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
};

const TYPING_ROLES = new Set(['combobox', 'listbox', 'option', 'textbox', 'searchbox']);

const TYPING_SELECTOR
  = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], [role="textbox"]';

const asTypingTarget = (target: EventTarget | null): TypingTarget | null => {
  if (!target || typeof target !== 'object') {
    return null;
  }

  return target as TypingTarget;
};

export const isAddConcertTypingTarget = (target: EventTarget | null): boolean => {
  const element = asTypingTarget(target);
  if (!element) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  const tag = element.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }

  const role = element.getAttribute?.('role');
  if (role && TYPING_ROLES.has(role)) {
    return true;
  }

  return Boolean(element.closest?.(TYPING_SELECTOR));
};

export const shouldOpenAddSheetOnKeydown = (event: AddConcertKeydownLike): boolean => {
  if (event.isComposing) {
    return false;
  }

  if (event.key !== 'n' && event.key !== 'N') {
    return false;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  if (isAddConcertTypingTarget(event.target)) {
    return false;
  }

  return true;
};
