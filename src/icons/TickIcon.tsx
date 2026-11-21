type TickIconProps = {
  width?: string;
};

export function TickIcon({ width = '100%' }: TickIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={width}
      fill="none"
      aria-hidden="true"
    >
      <path d="M4,13 L9,18 20,6" />
    </svg>
  );
}
