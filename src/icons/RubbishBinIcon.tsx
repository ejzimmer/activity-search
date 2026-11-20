type RubbishBinIconProps = {
  width?: string;
};

export function RubbishBinIcon({ width = '100%' }: RubbishBinIconProps) {
  return (
    <svg
      viewBox="0 0 20 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={width}
      fill="none"
      aria-hidden="true"
    >
      <path d="M2,6 L4,22 16,22, 18,6z" />
      <line x1="8" y1="9" x2="8" y2="18" />
      <line x1="12" y1="9" x2="12" y2="18" />
      <path d="M2,6 L2,4 18,4 18,6" />
      <line x1="9" y1="3" x2="11" y2="3" />
    </svg>
  );
}
