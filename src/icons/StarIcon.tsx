type StarIconProps = {
  width?: string;
  isFilled?: boolean;
};

export function StarIcon({ width = '100%', isFilled = false }: StarIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={width}
      fill={isFilled ? 'currentColor' : 'none'}
      aria-hidden="true"
    >
      <path d="M12,3 L14.6,8.6 20.6,9.2 16,13.3 17.4,19.4 12,16.2 6.6,19.4 8,13.3 3.4,9.2 9.4,8.6z" />
    </svg>
  );
}
