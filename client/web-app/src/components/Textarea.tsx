import clsx from 'clsx';
import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

type TextareaProps = React.ComponentProps<'textarea'> & {
  hasError?: boolean;
};

export const Textarea = forwardRef<HTMLInputElement, TextareaProps>(
  ({ className, hasError = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={twMerge(clsx(
        'block w-full rounded-md bg-background px-3 py-1.5',
        'text-base text-foreground',
        'outline-1 -outline-offset-1 outline-surface-300',
        'placeholder:text-surface-400',
        'focus:outline-2 focus:-outline-offset-2',
        'focus:outline-primary/50 sm:text-sm/6',
        'invalid:outline-danger invalid:focus:outline-danger',
        hasError && 'outline-danger focus:outline-danger',
        className,
      ))}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';