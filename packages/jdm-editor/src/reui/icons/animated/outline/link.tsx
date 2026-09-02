import type { CSSProperties } from 'react';

export default function LinkIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      style={style}
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M9 17H7A5 5 0 0 1 7 7h2' />
      <path d='M15 7h2a5 5 0 1 1 0 10h-2' />
      <path d='M8 12h8' />
    </svg>
  );
}
