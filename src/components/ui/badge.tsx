import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Bright status pill (AD-066): radius 4, soft tint, semibold. The follow-up
// variants (overdue, due, at-risk, done) are the only red, amber and green pills.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-accent text-primary [a]:hover:bg-accent/80",
        secondary: "border-border bg-muted text-ink [a]:hover:bg-accent",
        destructive: "bg-danger-soft text-danger [a]:hover:bg-danger-soft/80",
        outline: "border-border text-ink [a]:hover:bg-accent",
        ghost: "text-ink hover:bg-accent",
        link: "text-primary underline-offset-4 hover:underline",
        overdue: "bg-overdue-soft text-overdue",
        due: "bg-due-soft text-due-ink",
        "at-risk": "bg-at-risk-soft text-at-risk-ink",
        done: "bg-done-soft text-done",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
