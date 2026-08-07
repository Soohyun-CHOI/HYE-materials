import { Geist, Geist_Mono } from "next/font/google";
import { PRODUCT_NAME } from "@/lib/productName";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Both values were still create-next-app's defaults (#201). `template` is what
// lets every other page state only its own name — a page exports the bare
// "Invoices" and the tab reads that followed by the product name, which is
// appended in one place here rather than repeated per route. `default` covers
// the routes exporting no metadata of their own: the home page, which is the
// product, and /login, which is a Client Component and therefore cannot export
// any.
export const metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Purchase requests, purchase orders, invoices and deliveries for Hanyang ENG.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
