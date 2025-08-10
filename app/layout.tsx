import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RecorderProvider } from "./contexts/RecorderContext";
import RecorderUI from "./components/RecorderUI";
import Navigation from "./components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mini Component Bug Reporter",
  description: "Cross-browser element recorder using html2canvas → canvas.captureStream() → MediaRecorder.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RecorderProvider>
          <div className="p-6 max-w-4xl mx-auto pt-20">
            <Navigation />
            {children}
          </div>
          <RecorderUI />
        </RecorderProvider>
      </body>
    </html>
  );
}