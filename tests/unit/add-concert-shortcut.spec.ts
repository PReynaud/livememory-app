import { describe, expect, it } from 'vitest';
import { shouldOpenAddSheetOnKeydown } from '../../app/utils/add-concert-shortcut';

const keyEvent = (overrides: {
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  target?: EventTarget | null;
}) => ({
  key: 'n',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  target: null,
  ...overrides
});

const fakeElement = (overrides: {
  tagName?: string;
  role?: string | null;
  isContentEditable?: boolean;
  closestMatch?: boolean;
}) => ({
  tagName: overrides.tagName ?? 'DIV',
  isContentEditable: overrides.isContentEditable ?? false,
  getAttribute: (name: string) => (name === 'role' ? (overrides.role ?? null) : null),
  closest: () => (overrides.closestMatch ? {} : null)
});

describe('shouldOpenAddSheetOnKeydown', () => {
  it('opens on unmodified n when not typing', () => {
    expect(shouldOpenAddSheetOnKeydown(keyEvent({}))).toBe(true);
  });

  it('does not open for modifier+n', () => {
    expect(shouldOpenAddSheetOnKeydown(keyEvent({ ctrlKey: true }))).toBe(false);
    expect(shouldOpenAddSheetOnKeydown(keyEvent({ metaKey: true }))).toBe(false);
    expect(shouldOpenAddSheetOnKeydown(keyEvent({ altKey: true }))).toBe(false);
  });

  it('does not steal n from inputs, comboboxes, or IME composition', () => {
    expect(shouldOpenAddSheetOnKeydown(keyEvent({
      target: fakeElement({ tagName: 'INPUT' }) as unknown as EventTarget
    }))).toBe(false);
    expect(shouldOpenAddSheetOnKeydown(keyEvent({
      target: fakeElement({ role: 'textbox' }) as unknown as EventTarget
    }))).toBe(false);
    expect(shouldOpenAddSheetOnKeydown(keyEvent({
      target: fakeElement({ role: 'combobox' }) as unknown as EventTarget
    }))).toBe(false);
    expect(shouldOpenAddSheetOnKeydown(keyEvent({
      target: fakeElement({ role: 'listbox' }) as unknown as EventTarget
    }))).toBe(false);
    expect(shouldOpenAddSheetOnKeydown(keyEvent({
      target: fakeElement({ role: 'option' }) as unknown as EventTarget
    }))).toBe(false);
    expect(shouldOpenAddSheetOnKeydown(keyEvent({ isComposing: true }))).toBe(false);
  });
});
