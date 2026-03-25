import type { Metadata } from "next";
import { DM_Serif_Display, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Vox — Audio Transcription",
  description: "Transform audio into beautifully formatted transcripts with AI-powered precision.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSerif.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col">
        {children}
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: "oklch(0.15 0.01 70)",
              border: "1px solid oklch(0.25 0.02 70)",
              color: "oklch(0.9 0.01 80)",
            },
          }}
        />
      </body>
    </html>
  );
}
