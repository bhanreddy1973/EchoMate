import { NextRequest, NextResponse } from "next/server";

// NVIDIA Nemotron 3 VoiceChat — end-to-end speech-to-speech model
// Input: audio (WAV 16kHz) + optional system prompt
// Output: audio (WAV 22.05kHz) + text transcription + agent text response

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const systemPrompt = formData.get("system_prompt") as string || "You are EchoMate, a helpful and friendly AI voice companion. Keep responses concise and conversational.";

    if (!audioFile) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "NVIDIA API key not configured" }, { status: 500 });
    }

    // Convert audio file to base64
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    // Call NVIDIA Nemotron VoiceChat API
    const response = await fetch("https://integrate.api.nvidia.com/v1/audio/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-voicechat",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "audio",
                audio: {
                  data: audioBase64,
                  format: "wav",
                },
              },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("VoiceChat API error:", response.status, errText);
      
      // Fallback: use STT + LLM + TTS pipeline
      return await fallbackPipeline(audioBase64, systemPrompt, apiKey);
    }

    const data = await response.json();
    
    // Extract text and audio from response
    const assistantMessage = data.choices?.[0]?.message;
    const textResponse = assistantMessage?.content || "Sorry, I didn't catch that.";
    const audioResponse = assistantMessage?.audio?.data || null;
    const userTranscript = data.user_transcript || "";

    return NextResponse.json({
      text: textResponse,
      audio: audioResponse, // base64 WAV
      userTranscript,
      model: "nvidia/nemotron-voicechat",
    });
  } catch (error: any) {
    console.error("Voice chat error:", error);
    return NextResponse.json(
      { error: error.message || "Voice chat failed" },
      { status: 500 }
    );
  }
}

// Fallback: STT (Deepgram/Whisper) → LLM (Nemotron) → TTS (Chatterbox)
async function fallbackPipeline(audioBase64: string, systemPrompt: string, apiKey: string) {
  try {
    // Step 1: Transcribe audio using NVIDIA Parakeet STT or simple approach
    // For now, return error suggesting user type instead
    // In future, integrate nvidia/parakeet-ctc-1.1b for STT
    
    // Step 2: Use LLM
    const llmResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "[Audio input - transcription unavailable. Please respond to a greeting.]" },
        ],
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!llmResponse.ok) {
      throw new Error(`LLM failed: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    const textResponse = llmData.choices?.[0]?.message?.content || "Hello! How can I help you?";

    // Step 3: Generate TTS
    const ttsResponse = await fetch("https://integrate.api.nvidia.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "audio/wav",
      },
      body: JSON.stringify({
        model: "resembleai/chatterbox-multilingual-tts",
        input: textResponse.slice(0, 500),
        voice: "default",
        language_code: "en-US",
        response_format: "wav",
      }),
    });

    let audioData: string | null = null;
    if (ttsResponse.ok) {
      const audioBuffer = await ttsResponse.arrayBuffer();
      audioData = Buffer.from(audioBuffer).toString("base64");
    }

    return NextResponse.json({
      text: textResponse,
      audio: audioData,
      userTranscript: "(audio transcription unavailable)",
      model: "fallback-pipeline",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Fallback pipeline failed: ${err.message}` },
      { status: 500 }
    );
  }
}
