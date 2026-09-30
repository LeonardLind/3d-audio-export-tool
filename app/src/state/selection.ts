import type { Selection } from './types.ts';

export function applyClick(selection: Selection, index: number, count: number, shift = false): Selection {
  if (!Number.isInteger(index) || index < 0 || index >= count) return selection;
  if (selection.a === index) return { a: null, b: selection.b };
  if (selection.b === index) return { a: selection.a, b: null };
  if (shift || selection.a === null) return { a: index, b: selection.b };
  return { a: selection.a, b: index };
}

export function validSelection(selection: Selection, count: number): Selection {
  const a = selection.a !== null && selection.a >= 0 && selection.a < count ? selection.a : null;
  const b = selection.b !== null && selection.b >= 0 && selection.b < count && selection.b !== a ? selection.b : null;
  return { a, b };
}
