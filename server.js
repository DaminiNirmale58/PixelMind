const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HF_API_KEY = process.env.HF_API_KEY;
const SUPPORTED_MODELS = new Set(["black-forest-labs/FLUX.1-schnell"]);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

app.post("/api/generate", async (req, res) => {
  try {
    if (!HF_API_KEY) {
      return res
        .status(500)
        .json({ error: "HF_API_KEY is missing in environment variables." });
    }

    const { model, prompt, width, height } = req.body || {};

    if (!model || !prompt) {
      return res.status(400).json({ error: "Model and prompt are required." });
    }
    if (!SUPPORTED_MODELS.has(model)) {
      return res.status(400).json({
        error:
          "Selected model is currently unsupported. Please choose FLUX.1-schnell.",
      });
    }

    const hfResponse = await fetch(
      `https://router.huggingface.co/hf-inference/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
          "x-use-cache": "false",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { width, height },
        }),
      }
    );

    if (!hfResponse.ok) {
      let errorMessage = hfResponse.statusText || "Inference request failed";
      try {
        const errorJson = await hfResponse.json();
        errorMessage = errorJson?.error || errorMessage;
      } catch {
        const errorText = await hfResponse.text();
        if (errorText) errorMessage = errorText;
      }
      return res.status(hfResponse.status || 500).json({
        error: `Hugging Face API error: ${errorMessage}`,
      });
    }

    const imageBuffer = Buffer.from(await hfResponse.arrayBuffer());
    const contentType = hfResponse.headers.get("content-type") || "image/png";

    res.setHeader("Content-Type", contentType);
    return res.send(imageBuffer);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Unexpected server error while generating image.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI Image Generator server running at http://localhost:${PORT}`);
});
