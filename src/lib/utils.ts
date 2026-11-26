import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The Bright type scale and shadows from globals.css (AD-066). Without them
// tailwind-merge reads `text-title` as a colour and `shadow-action` as a shadow
// colour, and drops the wrong class.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "title",
        "section",
        "body",
        "body-strong",
        "small",
        "label",
        "num",
        "num-lg",
        "cell-dense",
      ],
      shadow: ["action", "card", "float"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
