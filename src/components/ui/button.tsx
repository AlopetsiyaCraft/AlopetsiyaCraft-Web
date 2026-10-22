import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "mc-btn group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "mc-btn-primary",
        outline: "",
        secondary: "",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-[var(--hover)] hover:shadow-none",
        destructive: "mc-btn-danger",
        link: "border-transparent bg-transparent px-0 shadow-none underline-offset-4 hover:bg-transparent hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        xs: "h-7 px-2 text-xs",
        sm: "h-8 px-2.5 text-[0.8rem]",
        lg: "h-11 px-5 text-base",
        icon: "size-9 p-0",
        "icon-xs": "size-7 p-0",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
