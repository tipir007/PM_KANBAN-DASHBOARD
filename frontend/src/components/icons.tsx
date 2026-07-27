import type { SVGProps } from "react";

const baseProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...baseProps} {...props}>
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...baseProps} {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const SendIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...baseProps} {...props}>
    <path d="M4 12l16-8-6 16-3-6-7-2z" />
  </svg>
);

export const SparkleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...baseProps} {...props}>
    <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
    <path d="M18 15l.8 2 2.2.8-2.2.8-.8 2-.8-2-2.2-.8 2.2-.8z" />
  </svg>
);
