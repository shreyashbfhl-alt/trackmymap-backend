import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { text } = req.body;

    if (!text || text.length < 3) {
      return res.status(400).json({ error: "Text is required" });
    }

    // 1️⃣ OpenAI extraction
    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: `
Extract real travel places from the text.
Rules:
- Only physical places people can visit
- Deduplicate
- Category: cafe | restaurant | attraction | nature | shopping | other
- Confidence between 0 and 1

Return ONLY JSON array like:
[
  {
    "name": "Place name",
    "category": "cafe",
    "confidence": 0.9
  }
]

Text:
${text}
`
            }
          ]
        })
      }
    );

    const aiJson = await aiResponse.json();
    const places = JSON.parse(aiJson.choices[0].message.content);

    const results = [];

    // 2️⃣ Google Geocoding
    for (const place of places) {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(place.name)}&key=${process.env.GOOGLE_MAPS_KEY}`
      );

      const geo = await geoRes.json();
      if (!geo.results || geo.results.length === 0) continue;

      const location = geo.results[0].geometry.location;

      results.push({
        id: uuidv4(),
        name: place.name,
        lat: location.lat,
        lng: location.lng,
        category: place.category,
        confidence: place.confidence
      });
    }

    return res.status(200).json(results);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
