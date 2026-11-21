import './AccountForm.css';
import { useState, type FormEvent, type ReactNode } from 'react';

type AccountFormProps = {
  heading: string;
  submitLabel: string;
  /** Resolves to a problem to show, or null when the form did its job. */
  onSubmit: (fields: FormData) => Promise<string | null>;
  children: ReactNode;
  footer: ReactNode;
};

export function AccountForm({
  heading,
  submitLabel,
  onSubmit,
  children,
  footer,
}: AccountFormProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const nextProblem = await onSubmit(new FormData(event.currentTarget));
    setIsSubmitting(false);
    setProblem(nextProblem);
  };

  return (
    <form className="account-form" onSubmit={submitForm}>
      <h1>{heading}</h1>
      {children}
      {problem && (
        <p role="alert" className="problem">
          {problem}
        </p>
      )}
      <button type="submit" disabled={isSubmitting}>
        {submitLabel}
      </button>
      <div className="footer">{footer}</div>
    </form>
  );
}
