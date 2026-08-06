import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "MidiFlow — Music, made tangible", template: "%s | MidiFlow" },
  description: "AI-assisted MIDI generation for artists and producers.",
  applicationName: "MidiFlow",
  icons: {
    icon: "/midiflow-logo.svg",
    shortcut: "/midiflow-logo.svg",
    apple: "/midiflow-logo.svg",
  },
  openGraph: { type: "website", siteName: "MidiFlow", title: "MidiFlow — Music, made tangible", description: "AI-assisted MIDI generation for artists and producers." },
  twitter: { card: "summary", title: "MidiFlow — Music, made tangible", description: "AI-assisted MIDI generation for artists and producers." },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}<Toaster richColors theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
