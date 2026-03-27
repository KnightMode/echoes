import type { Metadata } from "next";
import { Manrope, Crimson_Pro, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ScrollToTop } from "@/components/scroll-to-top";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-reading",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Echoes",
  description: "Audio transcription, beautifully simple.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${crimsonPro.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>
        {children}
        <ScrollToTop />
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "hsl(230 15% 10%)",
              border: "1px solid hsl(230 10% 18%)",
              color: "hsl(40 10% 92%)",
              borderRadius: "12px",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
        </MotionProvider>
      </body>
    </html>
  );
}
