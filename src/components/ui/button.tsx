import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 border px-3 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-blue-700 bg-blue-700 text-white hover:border-blue-800 hover:bg-blue-800",
        secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        danger: "border-red-700 bg-red-700 text-white hover:bg-red-800",
      },
      size: { default: "h-9 px-3", sm: "h-8 px-2.5 text-xs", icon: "h-9 w-9 px-0" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
