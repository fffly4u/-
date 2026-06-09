import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Maximum payload size for base64 image frames
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Server API endpoints
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    aiConfigured: !!ai,
    message: "AIGC video/image watermark remover services are online" 
  });
});

/**
 * AI-powered Inpainting Endpoint
 * Combines Gemini multimodal vision and editing. Receives a base64 1:1 image crops of watermark,
 * reconstructs the cover background, and returns the rebuilt base64 image block.
 */
app.post("/api/gemini/inpaint", async (req, res): Promise<any> => {
  try {
    const { image, prompt } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: "Missing base64 image content" });
    }

    // Is Gemini configured?
    if (!ai) {
      // Return beautiful warning indicating local fallback is active.
      return res.status(200).json({ 
        success: false, 
        fallback: true,
        message: "GEMINI_API_KEY has not been set yet. Seamless regional inpainting fallback activated.",
        explain: "The server-side Google GenAI services are idle. A highly advanced dual-biharmonic feathering engine is handling pixels locally."
      });
    }

    // Clean up base64 header if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/png"
      }
    };
    
    const textPart = {
      text: prompt || "This is a cropped square of a high definition texture covered partially by a text/logo watermark. Please identify the watermark elements, eliminate them, and generate the original matching background texture (e.g. skin, grass, wall, sky) seamlessly and photorealistically. Output only the inpainted image back."
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [imagePart, textPart] }
    });

    let inpaintedBase64 = null;
    let message = "";

    if (response?.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          inpaintedBase64 = part.inlineData.data;
        } else if (part.text) {
          message += part.text;
        }
      }
    }

    if (inpaintedBase64) {
      return res.json({
        success: true,
        image: `data:image/png;base64,${inpaintedBase64}`,
        info: "Reconstructed successfully by Gemini model"
      });
    } else {
      return res.json({
        success: false,
        fallback: true,
        message: "The model gave a text response instead of an inline image block.",
        explain: message || "Model did not output clean image content."
      });
    }

  } catch (error: any) {
    console.error("Gemini Inpaint Error:", error);
    return res.json({
      success: false,
      fallback: true,
      error: error.message || "An unexpected error occurred during Gemini AI reconstruction",
      message: "Server is online but Gemini was unable to solve the pixel fill. Using direct Canvas texture interpolation fallback."
    });
  }
});

// Vite middleware configuration for serving Client Side files
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite server middleware in DEV mode...");
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
  } else {
    console.log("Serving build artifacts in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⚡ Full-stack watermark removal app running on http://localhost:${PORT}`);
  });
}

setupVite();
