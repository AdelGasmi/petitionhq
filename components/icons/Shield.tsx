export function Shield({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.998 2.246c-2.43 1.94-5.546 3.1-8.932 3.1-.232 0-.463-.005-.692-.016A11.96 11.96 0 0 0 2 9.748c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.357-.226-2.662-.642-3.879-.213.01-.427.016-.643.016-3.386 0-6.502-1.16-8.075-3.64Z" />
    </svg>
  );
}
