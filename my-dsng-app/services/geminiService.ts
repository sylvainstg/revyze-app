import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_FLASH } from "../constants";

// Initialize the client
// Note: In a real app, handle missing API key gracefully.
// Safely access process.env for browser environments where process might be undefined
const getApiKey = () => {
  if (typeof process !== "undefined" && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return "";
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

export const analyzeDesignArea = async (
  base64Image: string,
  context?: string,
): Promise<string> => {
  if (!apiKey)
    return "Gemini API Key is missing. Please check your environment.";

  try {
    const prompt = context
      ? `You are an expert interior design and architecture consultant. Analyze this specific section of a floor plan or design document. 
         User Question/Context: "${context}". 
         Provide constructive, professional feedback or explanation. Keep it concise (under 100 words).`
      : `You are an expert interior design and architecture consultant. Analyze this specific section of a floor plan. 
         Identify what architectural elements are present (e.g., electrical symbols, furniture, structural elements) and suggest any potential improvements or issues. Keep it concise.`;

    // Clean the base64 string if it has the prefix
    const cleanBase64 = base64Image.replace(
      /^data:image\/(png|jpeg|jpg);base64,/,
      "",
    );

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_FLASH,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "Could not generate analysis.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error analyzing the design.";
  }
};

export const summarizeFeedback = async (
  comments: string[],
): Promise<string> => {
  if (!apiKey) return "Gemini API Key is missing.";

  try {
    const prompt = `You are a project manager for a home renovation. Summarize the following list of feedback points into a cohesive, polite, and actionable list for the designer.
    
    Feedback Points:
    ${comments.map((c, i) => `${i + 1}. ${c}`).join("\n")}
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_FLASH,
      contents: prompt,
    });

    return response.text || "Could not summarize feedback.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error creating summary.";
  }
};
