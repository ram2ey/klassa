import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 disabled:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover",
        secondary: "border-line bg-surface text-secondary hover:bg-surface-subtle hover:text-ink",
        ghost: "border-transparent bg-transparent text-secondary hover:bg-primary-subtle hover:text-selected",
        danger: "border-danger bg-danger text-white hover:brightness-90",
      },
      size: { default: "min-h-11 px-4 py-2", sm: "min-h-11 px-3 py-2 text-xs sm:min-h-9", icon: "h-11 w-11 p-0" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{asChild ? children : <>{loading && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{children}</>}</Component>;
}

export function IconButton({ label, ...props }: Omit<ButtonProps, "size" | "asChild" | "aria-label"> & { label: string }) {
  return <Button variant="ghost" {...props} size="icon" aria-label={label} title={label} />;
}
