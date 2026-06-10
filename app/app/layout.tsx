import type { Metadata } from "next";
import "./globals.css";
import { EmotionProvider } from "@/context/EmotionContext";

export const metadata: Metadata = {
  title: "EchoMate — Your Intelligent Voice Companion",
  description: "Premium AI voice companion. Tasks, insights, and conversation in one immersive spatial interface.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-emotion="idle" className="h-full">
      <head>
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#04040a" />
      </head>
      <body className="h-full overflow-hidden bg-void text-text-primary antialiased">
        <EmotionProvider>
          {children}
        </EmotionProvider>
      </body>
    </html>
  );
}
