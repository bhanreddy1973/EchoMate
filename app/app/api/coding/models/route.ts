import { NextResponse } from "next/server";

export async function GET() {
  const nvidiaConfigured = !!process.env.NVIDIA_NIM_API_KEY;
  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  const openRouterConfigured = !!process.env.OPENROUTER_API_KEY;

  const models = [
    {
      id: "meta/llama-3.1-70b-instruct",
      name: "Llama 3.1 70B",
      provider: "nvidia",
      tier: "technical",
      description: "Best for code generation and debugging",
      configured: nvidiaConfigured,
    },
    {
      id: "nvidia/llama-3.1-nemotron-70b-instruct",
      name: "Nemotron 70B",
      provider: "nvidia",
      tier: "reasoning",
      description: "Deep reasoning and complex problem solving",
      configured: nvidiaConfigured,
    },
    {
      id: "deepseek-ai/deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      provider: "nvidia",
      tier: "reasoning",
      description: "Advanced reasoning with DeepSeek architecture",
      configured: nvidiaConfigured,
    },
    {
      id: "moonshotai/kimi-k2.6",
      name: "Kimi K2.6",
      provider: "nvidia",
      tier: "technical",
      description: "Strong coding and technical analysis",
      configured: nvidiaConfigured,
    },
    {
      id: "z-ai/glm-5.1",
      name: "GLM 5.1",
      provider: "nvidia",
      tier: "technical",
      description: "Versatile language model for code and reasoning",
      configured: nvidiaConfigured,
    },
    {
      id: "google/diffusiongemma-26b-a4b-it",
      name: "DiffusionGemma 26B",
      provider: "nvidia",
      tier: "reasoning",
      description: "Google's thinking-enabled model",
      configured: nvidiaConfigured,
    },
    {
      id: "meta/llama-3.1-8b-instruct",
      name: "Llama 3.1 8B",
      provider: "nvidia",
      tier: "fast",
      description: "Fast responses for quick hints",
      configured: nvidiaConfigured,
    },
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      tier: "technical",
      description: "OpenAI flagship model",
      configured: openaiConfigured,
    },
    {
      id: "openai/gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "openai",
      tier: "fast",
      description: "Fast and affordable OpenAI model",
      configured: openaiConfigured,
    },
    {
      id: "google/gemini-pro",
      name: "Gemini Pro",
      provider: "gemini",
      tier: "technical",
      description: "Google Gemini Pro model",
      configured: geminiConfigured,
    },
    {
      id: "google/gemini-flash",
      name: "Gemini Flash",
      provider: "gemini",
      tier: "fast",
      description: "Google's fastest model",
      configured: geminiConfigured,
    },
    {
      id: "openrouter/auto",
      name: "OpenRouter Auto",
      provider: "openrouter",
      tier: "auto",
      description: "Auto-selects best available model",
      configured: openRouterConfigured,
    },
  ];

  return NextResponse.json({ models });
}
