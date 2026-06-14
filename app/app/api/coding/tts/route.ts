import { NextRequest, NextResponse } from "next/server";

// NVIDIA Chatterbox Multilingual TTS
// Supports 23 languages, auto-detects from input text
// Input: text + language code (BCP-47)
// Output: 24kHz WAV audio

const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "en-US",
  hi: "hi-IN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-BR",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  ar: "ar-SA",
  ru: "ru-RU",
  nl: "nl-NL",
  pl: "pl-PL",
  tr: "tr-TR",
  sv: "sv-SE",
  da: "da-DK",
  no: "nb-NO",
  fi: "fi-FI",
  cs: "cs-CZ",
  ro: "ro-RO",
  hu: "hu-HU",
  el: "el-GR",
};

// Simple language detection from text
function detectLanguage(text: string): string {
  // Hindi detection (Devanagari script)
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  // Chinese detection
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  // Japanese detection (Hiragana/Katakana)
  if (/[\u3040-\u30ff]/.test(text)) return "ja-JP";
  // Korean detection
  if (/[\uac00-\ud7af]/.test(text)) return "ko-KR";
  // Arabic detection
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";
  // Russian/Cyrillic detection
  if (/[\u0400-\u04FF]/.test(text)) return "ru-RU";
  // Greek detection
  if (/[\u0370-\u03FF]/.test(text)) return "el-GR";
  // Default to English
  return "en-US";
}

export async function POST(req: NextRequest) {
  try {
    const { text, language } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "NVIDIA API key not configured" },
        { status: 500 }
      );
    }

    // Detect language or use provided one
    const langCode = language || detectLanguage(text);

    // Truncate text to ~500 chars for TTS (avoid very long generations)
    const truncatedText = text.length > 500 ? text.slice(0, 500) + "..." : text;

    const response = await fetch(
      "https://integrate.api.nvidia.com/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "audio/wav",
        },
        body: JSON.stringify({
          model: "resembleai/chatterbox-multilingual-tts",
          input: truncatedText,
          voice: "default",
          language_code: langCode,
          response_format: "wav",
          emotion_exaggeration: 0.5,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("TTS error:", response.status, errText);
      return NextResponse.json(
        { error: `TTS failed: ${response.status}` },
        { status: 500 }
      );
    }

    // Return audio as binary
    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.byteLength),
      },
    });
  } catch (error: any) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: error.message || "TTS failed" },
      { status: 500 }
    );
  }
}
