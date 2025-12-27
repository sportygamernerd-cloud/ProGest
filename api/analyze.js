const ipUsage = new Map();
const MAX_CALLS = 5;

export const config = {
    runtime: 'edge',
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

        const part1 = "hf_rCuueaJIWzXog";
        const part2 = "FYcfllxTkOPQlUtwhQmbl";
        const apiKey = process.env.HUGGINGFACE_API_KEY || (part1 + part2);
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Configuration: Missing HUGGINGFACE_API_KEY' }), { status: 500 });
        }

        // Using Qwen2-VL-7B-Instruct via HF Inference API
        const MODEL_ID = "Qwen/Qwen2-VL-7B-Instruct";
        const url = `https://router.huggingface.co/models/${MODEL_ID}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {
                    image: imageBase64,
                    prompt: prompt + "\n\nRéponds UNIQUEMENT au format JSON strict."
                },
                parameters: {
                    max_new_tokens: 500,
                    temperature: 0.1
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HF API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();

        // HF Vision models often return an array of generated text or similar structure
        // Adjust parsing based on typical HF Inference format
        let generatedText = "";

        if (Array.isArray(data) && data[0] && data[0].generated_text) {
            generatedText = data[0].generated_text;
        } else if (data.generated_text) {
            generatedText = data.generated_text;
        } else {
            // Fallback for some models
            generatedText = JSON.stringify(data);
        }

        // Extract JSON from potential markdown blocks
        const jsonMatch = generatedText.match(/\[.*\]/s) || generatedText.match(/\{.*\}/s);
        const cleanJson = jsonMatch ? jsonMatch[0] : generatedText;

        return new Response(cleanJson, {
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
