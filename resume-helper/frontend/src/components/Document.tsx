import { Inter } from "next/font/google";
import { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
});

type Props = {
  children: ReactNode;
  locale: string;
  bodyClassName?: string;
};

export default function Document({ children, locale, bodyClassName }: Props) {
  return (
    <html className={inter.className} lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="icon" href="/logo.svg" />
      </head>
      <body className={bodyClassName}>{children}</body>
    </html>
  );
}
