/**
 * Stand-in for the parts of Framer's runtime the components use.
 *
 * Used only by the static demo build. Inside Framer the real module is
 * resolved instead, so nothing here ships to the published Framer site.
 *
 * Property controls exist to draw the editor's right-hand panel. There is no
 * panel on a plain web page, so registering them is a no-op and the components
 * fall back to the defaults in their own destructuring.
 */

export const ControlType = {
    String: "string",
    Color: "color",
    Boolean: "boolean",
    Number: "number",
    Enum: "enum",
    Link: "link",
    Object: "object",
    Array: "array",
} as const

export function addPropertyControls(
    _component: unknown,
    _controls: unknown
): void {
    // Intentionally empty. See above.
}
