type PinIconProps = {
  width?: string;
};

export function PinIcon({ width = '100%' }: PinIconProps) {
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
      <path d="M12,22 C12,22 4,14 4,9 A8,8 0 0 1 20,9 C20,14 12,22 12,22z" />
      <circle cx="12" cy="9" r="3" />
    </svg>
  );
}
