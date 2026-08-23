import type { CSSProperties } from 'react';
export default function CrossIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path
        d="M19.4325 6.10068C19.8558 5.67731 19.8558 4.9909 19.4325 4.56753C19.0091 4.14416 18.3227 4.14416 17.8993 4.56753L12 10.4668L6.10068 4.56753C5.67731 4.14416 4.9909 4.14416 4.56753 4.56753C4.14416 4.9909 4.14416 5.67731 4.56753 6.10068L10.4668 12L4.56753 17.8993C4.14416 18.3227 4.14416 19.0091 4.56753 19.4325C4.9909 19.8558 5.67731 19.8558 6.10068 19.4325L12 13.5332L17.8993 19.4325C18.3227 19.8558 19.0091 19.8558 19.4325 19.4325C19.8558 19.0091 19.8558 18.3227 19.4325 17.8993L13.5332 12L19.4325 6.10068Z"
        fill="currentColor"
      />
    </svg>
  )
}