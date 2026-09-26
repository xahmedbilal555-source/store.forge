import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function PageShell({ children }: Props) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>;
}
