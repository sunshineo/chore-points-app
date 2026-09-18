import type { ButtonHTMLAttributes } from "react";

const HEADER_ACTION_BUTTON_CLASS =
  "min-h-11 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-bold";

export function HeaderActionButton({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`${HEADER_ACTION_BUTTON_CLASS} ${className}`}
      {...props}
    />
  );
}
