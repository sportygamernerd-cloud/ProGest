const ipUsage = new Map();
const MAX_CALLS = 5;

export const config = {
    runtime: 'edge', // Use Edge Runtime for faster cold boots (optional, but good for simple fetch)
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // IP Rate Limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const used = ipUsage.get(ip) || 0;

    if (used >= MAX_CALLS) {
        return new Response(JSON.stringify({
            error: "Limite gratuite atteinte. Abonnement requis."
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    ipUsage.set(ip, used + 1);

    try {
        const { prompt, imageBase64 } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error: Missing API Key' }), { status: 500 });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;

        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                ]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        // Clean Markdown if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return new Response(cleanText, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
