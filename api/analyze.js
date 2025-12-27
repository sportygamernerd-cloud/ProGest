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

    // SIMULATION MODE (DEMO)
    // External APIs (Gemini, HF) are blocking. We return a mocked response for demo purposes.

    // Simulate processing delay (1.5s)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mocked AI Response
    const mockedResponse = [
        { "d": "Fourniture et pose de plaques de plâtre BA13", "q": 15, "p": 45 },
        { "d": "Bandes à joints et enduit de finition (3 passes)", "q": 15, "p": 22 },
        { "d": "Mise en peinture blanche (impression + 2 couches)", "q": 15, "p": 35 },
        { "d": "Nettoyage de fin de chantier", "q": 1, "p": 150 }
    ];

    return new Response(JSON.stringify(mockedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
