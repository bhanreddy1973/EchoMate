import { NextRequest, NextResponse } from "next/server";

// TTS Provider with automatic fallback chain:
// 1. NVIDIA Chatterbox Multilingual (when cloud endpoint becomes available)
// 2. Deepgram Aura TTS (current working provider)
// 3. Browser Speech Synthesis (client-side fallback, no server needed)

// ─── Provider 1: NVIDIA Chatterbox (future-ready) ───────────────────────────
async function tryNvidiaChatterbox(text: string, langCode: string, apiKey: string): Promise<ArrayBuffer | null> {
  // NVIDIA Chatterbox Multilingual TTS — endpoint will be available when NVIDIA
  // releases the cloud API. Currently only available as self-hosted NIM.
  // When available, the endpoint is expected to be:
  const endpoints = [
    "https://integrate.api.nvidia.com/v1/audio/speech",
    "https://integrate.api.nvidia.com/v1/tts/synthesize",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "audio/wav",
        },
        body: JSON.stringify({
          model: "resembleai/chatterbox-multilingual-tts",
          input: text,
          voice: "default",
          language_code: langCode,
          response_format: "wav",
          emotion_exaggeration: 0.5,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("audio")) {
          return await res.arrayBuffer();
        }
      }
    } catch {
      // Endpoint not available yet, try next
      continue;
    }
  }

  return null;
}

// ─── Provider 2: Deepgram Aura TTS (working now) ────────────────────────────
async function tryDeepgramTTS(text: string, apiKey: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&sample_rate=24000",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch {
    // Deepgram unavailable
  }

  return null;
}

// ─── Language detection ──────────────────────────────────────────────────────
function detectLanguage(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[\u3040-\u30ff]/.test(text)) return "ja-JP";
  if (/[\uac00-\ud7af]/.test(text)) return "ko-KR";
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";
  if (/[\u0400-\u04FF]/.test(text)) return "ru-RU";
  if (/[\u0370-\u03FF]/.test(text)) return "el-GR";
  return "en-US";
}

// ─── Main handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { text, language } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const nvidiaKey = process.env.NVIDIA_NIM_API_KEY || "";
    const deepgramKey = process.env.DEEPGRAM_API_KEY || "";
    const langCode = language || detectLanguage(text);

    // Truncate for TTS (keep it reasonable)
    const truncatedText = text.length > 500 ? text.slice(0, 500) + "..." : text;

    // Try providers in order of preference
    let audioBuffer: ArrayBuffer | null = null;

    // 1. Try NVIDIA Chatterbox (will start working when endpoint is released)
    if (nvidiaKey) {
      audioBuffer = await tryNvidiaChatterbox(truncatedText, langCode, nvidiaKey);
    }

    // 2. Fallback to Deepgram
    if (!audioBuffer && deepgramKey) {
      audioBuffer = await tryDeepgramTTS(truncatedText, deepgramKey);
    }

    // 3. If nothing works, tell the client to use browser speech synthesis
    if (!audioBuffer) {
      return NextResponse.json({
        fallback: "browser",
        text: truncatedText,
        language: langCode,
        message: "No TTS provider available. Using browser speech synthesis.",
      });
    }

    // Return audio
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.byteLength),
      },
    });
  } catch (error: any) {
    console.error("TTS error:", error);
    // Graceful fallback — never fail, just tell client to use browser TTS
    return NextResponse.json({
      fallback: "browser",
      text: "",
      language: "en-US",
      message: error.message || "TTS error, using browser fallback",
    });
  }
}
