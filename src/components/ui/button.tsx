import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "lime" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-mono font-bold uppercase transition-all duration-100 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none rounded-[2px] brutal-border";

    const variantStyles = {
      primary:
        "bg-[#16834A] text-white brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#253C2B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#253C2B]",
      lime:
        "bg-[#B7F28B] text-[#17251C] brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#253C2B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#253C2B]",
      secondary:
        "bg-white text-[#17251C] brutal-shadow-sm hover:bg-[#F4F1E8] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#253C2B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#253C2B]",
      danger:
        "bg-[#D94C4C] text-white brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#253C2B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#253C2B]",
      outline:
        "bg-transparent text-[#17251C] hover:bg-[#DDEBDD]",
      ghost:
        "border-transparent bg-transparent text-[#17251C] hover:bg-[#DDEBDD]",
    };

    const sizeStyles = {
      sm: "h-8 px-2.5 text-[11px] tracking-wider",
      md: "h-10 px-4 text-xs tracking-wider",
      lg: "h-12 px-6 text-sm tracking-wider",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
