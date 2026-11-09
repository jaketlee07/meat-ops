import { createElement, type ReactNode } from "react";
import { LineIcon } from "./line-icon";

// The parts every form repeats. Spec 2b's search and filters take the same ones.
//
// LABEL is the one label style for a label that names a text box, a dropdown, a date box, a text area, or
// the photo picker: 14 px, weight 500, in the secondary ink. A checkbox row's label keeps its own style.
// CONTROL is the box of a text field, dropdown, date box, or text area.
// PAIR wraps two neighboring number fields. They stack until the form around them is wide enough
// (the `field-pair` variant in globals.css). The form carries `@container/fields` so the variant has a container.
// SELECT_BOX and DATE_BOX are the boxes of a dropdown and a date box. Each sits in an IconBox, which draws the
// chevron or the calendar by LineIcon inside the box's right edge: the dropdown drops the browser's arrow, and the
// date box keeps room for the icon (12 px of left padding, 40 px of right padding) while the browser's own icon is
// made transparent and stretched over that padding (`.date-box` in globals.css), so a press on the icon still opens
// the browser's picker. A date box needs 156 px to show 11/09/2026 whole in that room.
// Tailwind reads class names from this file as written, so each class stays a whole literal.
export const LABEL = "block text-sm font-medium text-ink-secondary";
export const CONTROL = "mt-1 block w-full rounded-control border border-field-border bg-surface px-3 text-base text-ink";
export const SELECT_BOX = "block w-full appearance-none rounded-control border border-field-border bg-surface pl-3 pr-10 text-base text-ink";
export const DATE_BOX = "date-box block w-full rounded-control border border-field-border bg-surface pl-3 pr-10 text-base text-ink";
export const PAIR = "grid gap-3 field-pair:grid-cols-2 field-pair:gap-y-0";
// One field of a pair. Side by side, its label, box, and message sit on the pair's three shared rows, so a
// label that wraps in the narrow half pushes both boxes down together and their tops stay level.
export const PAIR_FIELD = "field-pair:row-span-3 field-pair:grid field-pair:grid-rows-subgrid field-pair:gap-y-0";

const ICON_PATHS = {
  chevron: "m6 9 6 6 6-6",
  calendar: "M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18",
};

// The wrapper of a dropdown or date box: the box, then its icon over the box's right edge. The icon is decoration,
// so it is hidden from assistive technology and takes no pointer events. `spacing` is the margin above the box. This file holds no markup of its own, so
// the wrapper is built with createElement.
export function IconBox({
  icon,
  spacing = "mt-1",
  children,
}: {
  icon: keyof typeof ICON_PATHS;
  spacing?: string;
  children: ReactNode;
}) {
  return createElement(
    "div",
    { className: `relative ${spacing}` },
    children,
    createElement(
      "span",
      { "aria-hidden": true, className: "pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-secondary" },
      createElement(LineIcon, { path: ICON_PATHS[icon], size: 20, strokeWidth: 2, roundJoin: true }),
    ),
  );
}
