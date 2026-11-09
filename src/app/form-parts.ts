// The parts every form repeats. Spec 2b's search and filters take the same ones.
//
// LABEL is the one label style for a label that names a text box, a dropdown, a date box, a text area, or
// the photo picker: 14 px, weight 500, in the secondary ink. A checkbox row's label keeps its own style.
// CONTROL is the box of a text field, dropdown, date box, or text area.
// PAIR wraps two neighboring number fields. They stack until the form around them is wide enough
// (the `field-pair` variant in globals.css). The form carries `@container/fields` so the variant has a container.
// Tailwind reads class names from this file as written, so each class stays a whole literal.
export const LABEL = "block text-sm font-medium text-ink-secondary";
export const CONTROL = "mt-1 block w-full rounded-control border border-field-border bg-surface px-3 text-base text-ink";
export const PAIR = "grid gap-3 field-pair:grid-cols-2 field-pair:gap-y-0";
// One field of a pair. Side by side, its label, box, and message sit on the pair's three shared rows, so a
// label that wraps in the narrow half pushes both boxes down together and their tops stay level.
export const PAIR_FIELD = "field-pair:row-span-3 field-pair:grid field-pair:grid-rows-subgrid field-pair:gap-y-0";
