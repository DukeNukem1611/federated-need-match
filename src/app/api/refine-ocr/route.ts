import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found, returning unrefined text");
      return NextResponse.json({ refinedText: text });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-pro";
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Refine the following text which was extracted from an image via OCR. Fix any scanning typos, restore logical sentences, remove random noise characters, and ensure it reads legibly. Return ONLY the refined text.

Text to refine:
"""
${text}
"""`;

    const result = await model.generateContent(prompt);
    const refinedText = result.response.text().trim();

    return NextResponse.json({ refinedText });
  } catch (err) {
    console.error("[refine-ocr] failed:", err);
    return NextResponse.json({ error: "Failed to refine text" }, { status: 500 });
  }
}