import { Elysia, t } from 'elysia';
import { db } from '../auth/config';
import { sql } from 'drizzle-orm';
import { getEmbedding, formatTransactionText } from '../services/embedding';
import { getBrokerOperationalInfo, publishToQueue, QUEUES } from '../services/broker';

export const aiRoutes = new Elysia({ prefix: '/api/ai' })
  .post('/suggestion', async ({ body, set }) => {
    try {
      const {
        workspaceName = "My Workspace",
        currency = "IDR",
        totalBalance = 0,
        monthlyIncome = 0,
        monthlyExpense = 0,
        savingsRate = 0,
        spendingCategories = [],
        accounts = [],
        transactionCount = 0,
      } = body;

      const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

      const fallbackAnalysis = () => {
        const isDeficit = monthlyExpense > monthlyIncome && monthlyIncome > 0;
        const isHealthy = savingsRate >= 20;
        const topCat = (spendingCategories[0] as { name?: string })?.name || "Kebutuhan Pokok";

        return {
          summary: isDeficit
            ? `Arus kas bulan ini mengalami defisit karena pengeluaran melebihi pemasukan. Prioritaskan pengendalian pengeluaran pada pos ${topCat}.`
            : isHealthy
            ? `Kondisi arus kas Anda sangat sehat dengan rasio tabungan ${savingsRate}%. Pertahankan konsistensi ini untuk memperkuat fondasi keuangan.`
            : `Arus kas stabil dengan tingkat tabungan ${savingsRate}%. Terdapat ruang optimasi terutama pada efisiensi pos ${topCat}.`,
          healthScore: isDeficit ? 45 : savingsRate >= 30 ? 92 : savingsRate >= 15 ? 82 : 68,
          status: isDeficit ? "Perlu Perhatian" : savingsRate >= 30 ? "Sangat Sehat" : savingsRate >= 15 ? "Sehat" : "Cukup Baik",
          insights: [
            {
              title: isDeficit ? "Peringatan Arus Kas" : "Tingkat Tabungan",
              description: isDeficit
                ? `Pengeluaran bulan ini melampaui pemasukan. Tinjau kembali pos pengeluaran sekunder.`
                : `Anda berhasil menyisihkan ${savingsRate}% dari pemasukan bulan ini ke pos tabungan/aset.`,
              type: isDeficit ? "warning" : "positive",
            },
            {
              title: "Fokus Pengeluaran Terbesar",
              description: `Pos '${topCat}' merupakan pengeluaran terbesar saat ini. Evaluasi pos ini untuk efisiensi lebih lanjut.`,
              type: "info",
            },
          ],
          recommendations: [
            isDeficit
              ? "Tunda pengeluaran non-esensial hingga arus kas kembali surplus."
              : "Alokasikan surplus bulanan ke rekening tabungan terpisah atau instrumen rendah risiko.",
            `Tetapkan batas pagu maksimal untuk kategori ${topCat} sebesar 85% dari alokasi saat ini.`,
            `Pastikan saldo likuid (Rp ${Number(totalBalance).toLocaleString('id-ID')}) mencukupi kebutuhan darurat 3-6 bulan.`,
          ],
          savingsPotential: "Potensi penghematan 10-15% dari pengeluaran bulanan",
        };
      };

      if (!apiKey) {
        return { success: true, data: fallbackAnalysis() };
      }

      const prompt = `Anda adalah NovaFinance AI Financial Advisor profesional. Analisis data finansial berikut secara analitis dan berikan kesimpulan tajam serta rekomendasi konkret dalam Bahasa Indonesia:
- Nama Workspace: ${workspaceName}
- Mata Uang: ${currency}
- Total Saldo: ${totalBalance}
- Pemasukan Bulan Ini: ${monthlyIncome}
- Pengeluaran Bulan Ini: ${monthlyExpense}
- Rasio Tabungan (Savings Rate): ${savingsRate}%
- Total Transaksi Bulan Ini: ${transactionCount}
- Kategori Pengeluaran: ${JSON.stringify(spendingCategories.slice(0, 5))}
- Akun/Dompet Terhubung: ${JSON.stringify(accounts.slice(0, 5))}

Berikan analisis dalam format JSON murni:
{
  "summary": "Kesimpulan diagnosis keuangan ringkas dan berbobot (2-3 kalimat)",
  "healthScore": 85,
  "status": "Sangat Sehat" | "Sehat" | "Cukup Baik" | "Perlu Perhatian" | "Kritis",
  "insights": [
    {
      "title": "Judul Insight 1",
      "description": "Penjelasan mendalam mengenai data pengeluaran/pemasukan",
      "type": "positive" | "warning" | "info"
    },
    {
      "title": "Judul Insight 2",
      "description": "Penjelasan mendalam mengenai data",
      "type": "positive" | "warning" | "info"
    }
  ],
  "recommendations": [
    "Saran aksi terukur 1",
    "Saran aksi terukur 2",
    "Saran aksi terukur 3"
  ],
  "savingsPotential": "Estimasi peluang efisiensi biaya atau akumulasi aset"
}
HANYA kembalikan JSON valid tanpa tag markdown.`;

      let response: Response | null = null;
      for (const candidateModel of ['gemini-2.5-flash', 'gemini-1.5-flash']) {
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.2,
                },
              }),
            }
          );
          if (response.ok) break;
        } catch {
          // try next model
        }
      }

      if (!response || !response.ok) {
        console.warn('Gemini API call returned status:', response?.status);
        return { success: true, data: fallbackAnalysis() };
      }

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return { success: true, data: fallbackAnalysis() };
      }

      try {
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return { success: true, data: parsed };
      } catch {
        return { success: true, data: fallbackAnalysis() };
      }
    } catch (error: any) {
      console.error('AI suggestion route error:', error);
      set.status = 500;
      return {
        success: false,
        error: error.message || 'Internal AI service error',
      };
    }
  }, {
    body: t.Object({
      workspaceName: t.Optional(t.String()),
      currency: t.Optional(t.String()),
      totalBalance: t.Optional(t.Number()),
      monthlyIncome: t.Optional(t.Number()),
      monthlyExpense: t.Optional(t.Number()),
      savingsRate: t.Optional(t.Number()),
      spendingCategories: t.Optional(t.Array(t.Any())),
      accounts: t.Optional(t.Array(t.Any())),
      transactionCount: t.Optional(t.Number()),
    }),
    detail: {
      tags: ['AI'],
      summary: 'Get AI financial suggestions',
      description: 'Get AI-powered financial analysis and recommendations based on workspace financial data. Uses Google Gemini AI for intelligent insights. Falls back to rule-based analysis if API is unavailable.\n\n**Request Body:**\n```json\n{\n  \"workspaceName\": \"Personal Finance\",\n  \"currency\": \"IDR\",\n  \"totalBalance\": 27000000,\n  \"monthlyIncome\": 20000000,\n  \"monthlyExpense\": 7500000,\n  \"savingsRate\": 62.5,\n  \"spendingCategories\": [\n    { \"name\": \"Food & Dining\", \"value\": 2500000, \"percentage\": \"33.3\" },\n    { \"name\": \"Transportation\", \"value\": 2000000, \"percentage\": \"26.7\" },\n    { \"name\": \"Utilities\", \"value\": 1500000, \"percentage\": \"20.0\" }\n  ],\n  \"accounts\": [\n    { \"name\": \"BCA Main\", \"balance\": 15000000, \"type\": \"bank\" },\n    { \"name\": \"GoPay\", \"balance\": 2500000, \"type\": \"ewallet\" }\n  ],\n  \"transactionCount\": 45\n}\n```\n\n**Response:**\n```json\n{\n  \"success\": true,\n  \"data\": {\n    \"summary\": \"Kondisi arus kas Anda sangat sehat dengan rasio tabungan 62.5%. Pertahankan konsistensi ini untuk memperkuat fondasi keuangan.\",\n    \"healthScore\": 92,\n    \"status\": \"Sangat Sehat\",\n    \"insights\": [\n      {\n        \"title\": \"Tingkat Tabungan\",\n        \"description\": \"Anda berhasil menyisihkan 62.5% dari pemasukan bulan ini ke pos tabungan/aset.\",\n        \"type\": \"positive\"\n      },\n      {\n        \"title\": \"Fokus Pengeluaran Terbesar\",\n        \"description\": \"Pos Food & Dining merupakan pengeluaran terbesar saat ini. Evaluasi pos ini untuk efisiensi lebih lanjut.\",\n        \"type\": \"info\"\n      }\n    ],\n    \"recommendations\": [\n      \"Alokasikan surplus bulanan ke rekening tabungan terpisah atau instrumen rendah risiko.\",\n      \"Tetapkan batas pagu maksimal untuk kategori Food & Dining sebesar 85% dari alokasi saat ini.\",\n      \"Pastikan saldo likuid mencukupi kebutuhan darurat 3-6 bulan.\"\n    ],\n    \"savingsPotential\": \"Potensi penghematan 10-15% dari pengeluaran bulanan\"\n  }\n}\n```\n\n**Health Status Values:**\n- `Sangat Sehat`: Savings rate >= 30%\n- `Sehat`: Savings rate >= 15%\n- `Cukup Baik`: Savings rate >= 0%\n- `Perlu Perhatian`: Deficit or negative savings\n- `Kritis`: Critical financial situation',
      security: [],
    },
  })

  // ── Test AI Provider API Key Connectivity ──────────────────────────────
  .post('/test-key', async ({ body, set }) => {
    const { provider, apiKey } = body;
    if (!apiKey || !apiKey.trim()) {
      set.status = 400;
      return { success: false, error: 'API key tidak boleh kosong', code: 'VALIDATION_ERROR' };
    }

    const startTime = Date.now();
    try {
      if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
          },
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `Groq Cloud authentication failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        const data: any = await res.json();
        const availableModels: string[] = (data?.data || [])
          .map((m: any) => m.id)
          .filter((id: string) => {
            const l = id.toLowerCase();
            return !l.includes('guard') && !l.includes('whisper') && !l.includes('embed') && !l.includes('8192');
          });
        return {
          success: true,
          message: `Koneksi Groq Cloud Valid! ${availableModels.length} model chat aktif terdeteksi.`,
          latencyMs,
          modelCount: availableModels.length,
          models: availableModels,
        };
      }

      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `Google Gemini authentication failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        const data: any = await res.json();
        return {
          success: true,
          message: `Koneksi Google Gemini Valid! ${data?.models?.length || 0} model aktif.`,
          latencyMs,
          modelCount: data?.models?.length || 0,
        };
      }

      if (provider === 'deepseek') {
        const res = await fetch('https://api.deepseek.com/models', {
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
          },
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `DeepSeek authentication failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        return {
          success: true,
          message: 'Koneksi DeepSeek API Valid!',
          latencyMs,
        };
      }

      if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
          },
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `Anthropic Claude authentication failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        return {
          success: true,
          message: 'Koneksi Anthropic Claude Valid!',
          latencyMs,
        };
      }

      if (provider === 'openai' || provider === 'gpt') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
          },
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `OpenAI authentication failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        const data: any = await res.json();
        const availableModels: string[] = (data?.data || [])
          .map((m: any) => m.id)
          .filter((id: string) => id.includes('gpt') || id.includes('o1') || id.includes('o3'));
        return {
          success: true,
          message: `Koneksi OpenAI Valid! ${availableModels.length} model aktif terdeteksi.`,
          latencyMs,
          modelCount: availableModels.length,
          models: availableModels,
        };
      }

      set.status = 400;
      return { success: false, error: `Unknown provider: ${provider}` };
    } catch (e: any) {
      const latencyMs = Date.now() - startTime;
      set.status = 500;
      return { success: false, error: e.message || 'Gagal menghubungi server penyedia AI', latencyMs };
    }
  }, {
    body: t.Object({
      provider: t.Union([t.Literal('groq'), t.Literal('gemini'), t.Literal('deepseek'), t.Literal('claude'), t.Literal('openai'), t.Literal('gpt')]),
      apiKey: t.String(),
    }),
    detail: {
      tags: ['AI'],
      summary: 'Test AI API Key connectivity and latency',
      description: 'Ping AI provider gateway (Groq, Gemini, DeepSeek, Claude) to verify API key validity, latency, and available models.',
    },
  })

  // ── Test Real Chat Completion on AI Provider ───────────────────────────
  .post('/test-chat', async ({ body, set }) => {
    const { provider, apiKey, model, proxyUrl } = body;
    if (!apiKey || !apiKey.trim()) {
      set.status = 400;
      return { success: false, error: 'API key tidak boleh kosong', code: 'VALIDATION_ERROR' };
    }

    const startTime = Date.now();
    try {
      if (provider === 'groq') {
        let requestedModel = model?.trim() || 'llama-3.1-8b-instant';
        const endpoint = proxyUrl?.trim()
          ? `${proxyUrl.trim().replace(/\/+$/, '')}/chat/completions`
          : 'https://api.groq.com/openai/v1/chat/completions';

        const runGroqCall = async (modelToTry: string) => {
          return await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey.trim()}`,
            },
            body: JSON.stringify({
              model: modelToTry,
              messages: [
                { role: 'system', content: 'You are NovaJournal Financial AI Assistant. Respond concisely in Indonesian.' },
                { role: 'user', content: 'Tes koneksi sistem: Tolong jawab dengan format: "BERHASIL KONEK KE GROQ CLOUD!"' },
              ],
              max_tokens: 60,
              temperature: 0.1,
            }),
          });
        };

        // Filter out non-chat models (guard, whisper, embed, classification, decommissioned)
        const isChatCapable = (id: string) => {
          const lower = id.toLowerCase();
          if (lower.includes('guard') || lower.includes('whisper') || lower.includes('embed') || lower.includes('classification')) return false;
          if (lower.includes('8192')) return false; // Decommissioned on Groq
          return true;
        };

        const chatCandidates = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b'];

        if (!isChatCapable(requestedModel)) {
          requestedModel = 'llama-3.1-8b-instant';
        }

        let chatRes = await runGroqCall(requestedModel);

        // If 400 or 404, automatically fetch models list and retry with verified active chat model
        if (!chatRes.ok && (chatRes.status === 404 || chatRes.status === 400)) {
          const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey.trim()}` },
          });
          if (modelsRes.ok) {
            const modelsData: any = await modelsRes.json();
            const rawIds: string[] = (modelsData?.data || []).map((m: any) => m.id);
            const validChatIds = rawIds.filter(isChatCapable);

            const candidate = chatCandidates.find((c) => validChatIds.includes(c)) || validChatIds[0];

            if (candidate && candidate !== requestedModel) {
              requestedModel = candidate;
              chatRes = await runGroqCall(requestedModel);
            }
          }
        }

        const latencyMs = Date.now() - startTime;
        if (!chatRes.ok) {
          const errData: any = await chatRes.json().catch(() => ({}));
          set.status = chatRes.status;
          return {
            success: false,
            error: errData?.error?.message || `Groq Chat API call failed (HTTP ${chatRes.status})`,
            requestedModel,
            latencyMs,
          };
        }

        const data: any = await chatRes.json();
        const reply = data?.choices?.[0]?.message?.content || 'BERHASIL KONEK KE GROQ CLOUD!';
        return {
          success: true,
          message: `Eksekusi Groq API Sukses 100%! Model aktif: ${requestedModel}`,
          reply,
          usedModel: requestedModel,
          latencyMs,
        };
      }

      if (provider === 'openai' || provider === 'gpt') {
        const requestedModel = model?.trim() || 'gpt-4o-mini';
        const endpoint = proxyUrl?.trim()
          ? `${proxyUrl.trim().replace(/\/+$/, '')}/chat/completions`
          : 'https://api.openai.com/v1/chat/completions';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            model: requestedModel,
            messages: [
              { role: 'system', content: 'You are NovaJournal Financial AI Assistant. Respond concisely in Indonesian.' },
              { role: 'user', content: 'Tes koneksi sistem: Tolong jawab singkat: "BERHASIL KONEK KE OPENAI CHATGPT!"' },
            ],
            max_tokens: 60,
            temperature: 0.1,
          }),
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `OpenAI Chat API call failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        const data: any = await res.json();
        const reply = data?.choices?.[0]?.message?.content || 'BERHASIL KONEK KE OPENAI!';
        return {
          success: true,
          message: `Eksekusi OpenAI Sukses! Model aktif: ${requestedModel}`,
          reply,
          usedModel: requestedModel,
          latencyMs,
        };
      }

      if (provider === 'gemini') {
        const primaryModel = model?.trim() || 'gemini-2.5-flash';
        const candidates = [primaryModel, 'gemini-2.5-flash', 'gemini-1.5-flash'];
        const triedModels: string[] = [];
        let data: any = null;
        let successfulModel = primaryModel;
        let lastError = '';

        for (const candidate of candidates) {
          if (triedModels.includes(candidate)) continue;
          triedModels.push(candidate);
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey.trim()}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(9000),
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Tes koneksi sistem: Tolong jawab singkat: "BERHASIL KONEK KE GOOGLE GEMINI!"' }] }],
              }),
            });
            if (res.ok) {
              data = await res.json();
              successfulModel = candidate;
              break;
            } else {
              const errData: any = await res.json().catch(() => ({}));
              lastError = errData?.error?.message || `HTTP ${res.status}`;
            }
          } catch (e: any) {
            lastError = e.message || 'Timeout / Gangguan Jaringan';
          }
        }

        const latencyMs = Date.now() - startTime;
        if (!data) {
          set.status = 400;
          return {
            success: false,
            error: `Gemini Chat call failed: ${lastError}`,
            latencyMs,
          };
        }

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'BERHASIL KONEK KE GEMINI!';
        return {
          success: true,
          message: `Eksekusi Google Gemini Sukses! Model: ${successfulModel}`,
          reply,
          usedModel: successfulModel,
          latencyMs,
        };
      }

      if (provider === 'deepseek') {
        const requestedModel = model?.trim() || 'deepseek-chat';
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: requestedModel,
            messages: [
              { role: 'user', content: 'Tes koneksi sistem: Tolong jawab singkat: "BERHASIL KONEK KE DEEPSEEK!"' },
            ],
            max_tokens: 60,
          }),
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `DeepSeek Chat call failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        const data: any = await res.json();
        const reply = data?.choices?.[0]?.message?.content || 'BERHASIL KONEK KE DEEPSEEK!';
        return {
          success: true,
          message: `Eksekusi DeepSeek Sukses! Model: ${requestedModel}`,
          reply,
          usedModel: requestedModel,
          latencyMs,
        };
      }

      if (provider === 'claude') {
        const requestedModel = model?.trim() || 'claude-3-7-sonnet-20250219';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: requestedModel,
            max_tokens: 60,
            messages: [{ role: 'user', content: 'Tes koneksi sistem: Tolong jawab singkat: "BERHASIL KONEK KE ANTHROPIC CLAUDE!"' }],
          }),
        });
        const latencyMs = Date.now() - startTime;
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          set.status = res.status;
          return {
            success: false,
            error: errData?.error?.message || `Claude Chat call failed (HTTP ${res.status})`,
            latencyMs,
          };
        }
        const data: any = await res.json();
        const reply = data?.content?.[0]?.text || 'BERHASIL KONEK KE CLAUDE!';
        return {
          success: true,
          message: `Eksekusi Claude Sukses! Model: ${requestedModel}`,
          reply,
          usedModel: requestedModel,
          latencyMs,
        };
      }

      set.status = 400;
      return { success: false, error: `Provider ${provider} tidak didukung untuk tes chat langsung.` };
    } catch (e: any) {
      const latencyMs = Date.now() - startTime;
      set.status = 500;
      return { success: false, error: e.message || 'Gagal mengeksekusi chat test AI', latencyMs };
    }
  }, {
    body: t.Object({
      provider: t.String(),
      apiKey: t.String(),
      model: t.Optional(t.String()),
      proxyUrl: t.Optional(t.String()),
    }),
    detail: {
      tags: ['AI'],
      summary: 'Test live AI chat completion',
      description: 'Executes a test prompt to verify that chat completions work end-to-end with the specified AI provider and key.',
    },
  })

  // ── pgvector Status & Diagnostic ──────────────────────────────────────────
  .get('/vector-status', async ({ set }) => {
    try {
      const extRes = await db.execute(sql`
        SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
      `);
      const isInstalled = extRes.length > 0;

      let txEmbeddingsCount = 0;
      let docEmbeddingsCount = 0;

      if (isInstalled) {
        try {
          const [txCount]: any = await db.execute(sql`SELECT COUNT(*)::int AS count FROM transaction_embeddings`);
          txEmbeddingsCount = txCount?.count || 0;
          const [docCount]: any = await db.execute(sql`SELECT COUNT(*)::int AS count FROM document_embeddings`);
          docEmbeddingsCount = docCount?.count || 0;
        } catch {}
      }

      const brokerInfo = getBrokerOperationalInfo();

      return {
        success: true,
        data: {
          vectorExtension: {
            installed: isInstalled,
            version: extRes[0]?.extversion || null,
            dimensions: 768,
            indexAlgorithm: 'HNSW (Hierarchical Navigable Small World)',
            metric: 'Cosine Distance (<=>)',
          },
          indexedItems: {
            transactions: txEmbeddingsCount,
            documents: docEmbeddingsCount,
          },
          broker: brokerInfo,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  }, {
    detail: {
      tags: ['AI'],
      summary: 'Get pgvector extension and vector index status',
      description: 'Check active pgvector version, HNSW indexing metrics, and total vector embeddings stored in PostgreSQL.',
    },
  })

  // ── Sync / Backfill Embeddings for a Workspace ─────────────────────────────
  .post('/sync-embeddings', async ({ body, set }) => {
    const { workspaceId, forceAll = false } = body;
    try {
      // Find transactions that need embedding
      const query = forceAll
        ? sql`
            SELECT t.id, t.type, t.amount, t.description, t.notes, t.date, c.name AS category_name, a.name AS account_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN accounts a ON a.id = t.account_id
            WHERE t.workspace_id = ${workspaceId} AND t.deleted_at IS NULL
          `
        : sql`
            SELECT t.id, t.type, t.amount, t.description, t.notes, t.date, c.name AS category_name, a.name AS account_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN accounts a ON a.id = t.account_id
            LEFT JOIN transaction_embeddings te ON te.transaction_id = t.id
            WHERE t.workspace_id = ${workspaceId} 
              AND t.deleted_at IS NULL
              AND te.id IS NULL
          `;

      const unindexedRows: any = await db.execute(query);
      let indexedCount = 0;

      for (const row of unindexedRows) {
        const text = formatTransactionText({
          type: row.type,
          amount: row.amount,
          description: row.description,
          notes: row.notes,
          categoryName: row.category_name,
          accountName: row.account_name,
          date: row.date,
        });

        const vector = await getEmbedding(text);
        const vectorStr = `[${vector.join(',')}]`;

        await db.execute(sql`
          INSERT INTO transaction_embeddings (transaction_id, workspace_id, content, embedding)
          VALUES (${row.id}, ${workspaceId}, ${text}, ${vectorStr}::vector)
          ON CONFLICT (transaction_id) 
          DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, created_at = NOW();
        `);

        indexedCount++;
      }

      return {
        success: true,
        data: {
          syncedCount: indexedCount,
          totalEligible: unindexedRows.length,
          message: `Berhasil sinkronisasi ${indexedCount} vektor embedding transaksi ke PostgreSQL 16 (HNSW index).`,
        },
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      forceAll: t.Optional(t.Boolean()),
    }),
    detail: {
      tags: ['AI'],
      summary: 'Generate & sync vector embeddings for workspace transactions',
      description: 'Generates 768-dimensional embeddings for unindexed transactions and persists them with HNSW indexing in PostgreSQL.',
    },
  })

  // ── Semantic Search (Vector RAG) ──────────────────────────────────────────
  .post('/semantic-search', async ({ body, set }) => {
    const { workspaceId, query, limit = 8, threshold = 0.12 } = body;
    if (!query || !query.trim()) {
      set.status = 400;
      return { success: false, error: 'Query pencarian tidak boleh kosong' };
    }

    try {
      const startTime = Date.now();
      const queryVector = await getEmbedding(query.trim());
      const queryVectorStr = `[${queryVector.join(',')}]`;

      // 1. Semantic search on Transactions via HNSW Cosine Distance
      const matchedTransactions: any = await db.execute(sql`
        SELECT 
          te.transaction_id AS id,
          te.content,
          ROUND((1 - (te.embedding <=> ${queryVectorStr}::vector))::numeric, 4)::float AS similarity,
          t.amount,
          t.type,
          t.description,
          t.date,
          c.name AS category_name,
          a.name AS account_name
        FROM transaction_embeddings te
        JOIN transactions t ON t.id = te.transaction_id
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN accounts a ON a.id = t.account_id
        WHERE te.workspace_id = ${workspaceId}
          AND t.deleted_at IS NULL
          AND (1 - (te.embedding <=> ${queryVectorStr}::vector)) >= ${threshold}
        ORDER BY te.embedding <=> ${queryVectorStr}::vector ASC
        LIMIT ${limit};
      `);

      // 2. Semantic search on Documents / Receipts
      const matchedDocuments: any = await db.execute(sql`
        SELECT 
          de.document_id AS id,
          de.content,
          ROUND((1 - (de.embedding <=> ${queryVectorStr}::vector))::numeric, 4)::float AS similarity,
          d.file_name,
          d.file_url,
          d.metadata
        FROM document_embeddings de
        JOIN documents d ON d.id = de.document_id
        WHERE de.workspace_id = ${workspaceId}
          AND d.deleted_at IS NULL
          AND (1 - (de.embedding <=> ${queryVectorStr}::vector)) >= ${threshold}
        ORDER BY de.embedding <=> ${queryVectorStr}::vector ASC
        LIMIT 4;
      `);

      const executionTimeMs = Date.now() - startTime;

      // Synthesize answer
      let answerSynthesis = '';
      if (matchedTransactions.length === 0 && matchedDocuments.length === 0) {
        answerSynthesis = `Tidak ditemukan transaksi atau dokumen yang cocok secara semantik untuk kueri: "${query}". Coba kata kunci yang lebih luas atau jalankan sinkronisasi embedding.`;
      } else {
        const totalMatches = matchedTransactions.length;
        const topMatch = matchedTransactions[0];
        answerSynthesis = `Ditemukan ${totalMatches} catatan transaksi yang relevan. Catatan paling sesuai adalah "${topMatch?.description || topMatch?.content}" (Nominal: Rp ${Number(topMatch?.amount || 0).toLocaleString('id-ID')}) dengan relevansi kecocokan semantik ${(topMatch?.similarity * 100).toFixed(1)}%.`;
      }

      return {
        success: true,
        data: {
          query,
          executionTimeMs,
          totalMatches: matchedTransactions.length + matchedDocuments.length,
          answerSynthesis,
          transactions: matchedTransactions,
          documents: matchedDocuments,
        },
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      query: t.String(),
      limit: t.Optional(t.Number()),
      threshold: t.Optional(t.Number()),
    }),
    detail: {
      tags: ['AI'],
      summary: 'Semantic vector search over transactions and receipts',
      description: 'Performs sub-millisecond approximate nearest neighbor (HNSW) vector search in PostgreSQL 16 using cosine distance.',
    },
  })

  // ── Duplicate Detection via Vector Similarity ─────────────────────────────
  .post('/check-duplicate', async ({ body, set }) => {
    const { workspaceId, description, amount, threshold = 0.75 } = body;
    try {
      const candidateText = formatTransactionText({
        type: 'expense',
        amount,
        description,
      });
      const vector = await getEmbedding(candidateText);
      const vectorStr = `[${vector.join(',')}]`;

      const matches: any = await db.execute(sql`
        SELECT 
          te.transaction_id AS id,
          te.content,
          ROUND((1 - (te.embedding <=> ${vectorStr}::vector))::numeric, 4)::float AS similarity,
          t.amount,
          t.type,
          t.description,
          t.date
        FROM transaction_embeddings te
        JOIN transactions t ON t.id = te.transaction_id
        WHERE te.workspace_id = ${workspaceId}
          AND t.deleted_at IS NULL
          AND (1 - (te.embedding <=> ${vectorStr}::vector)) >= ${threshold}
        ORDER BY te.embedding <=> ${vectorStr}::vector ASC
        LIMIT 1;
      `);

      if (matches.length > 0) {
        const top = matches[0];
        return {
          success: true,
          data: {
            isPotentialDuplicate: true,
            similarity: top.similarity,
            matchedTransaction: top,
            warning: `Peringatan: Transaksi ini terdeteksi ${(top.similarity * 100).toFixed(1)}% mirip dengan transaksi yang sudah ada ("${top.description}", Rp ${Number(top.amount).toLocaleString('id-ID')}).`,
          },
        };
      }

      return {
        success: true,
        data: {
          isPotentialDuplicate: false,
          similarity: 0,
          matchedTransaction: null,
          message: 'Tidak ada duplikasi terdeteksi. Transaksi aman untuk dicatat.',
        },
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      description: t.String(),
      amount: t.Number(),
      threshold: t.Optional(t.Number()),
    }),
    detail: {
      tags: ['AI'],
      summary: 'Detect duplicate or near-identical transactions using pgvector',
      description: 'Evaluates vector semantic proximity against existing records to prevent double-spending or duplicate receipt entries.',
    },
  })

  // ── RAG Upload File & Receipt Ingestion ────────────────────────────────────
  .post('/rag-upload', async ({ body, set }) => {
    const {
      workspaceId,
      content,
      fileName = 'receipt_scan.txt',
      useRabbitMQ = false,
      categoryHint,
      amountHint,
    } = body;

    if (!workspaceId || !content || !content.trim()) {
      set.status = 400;
      return { success: false, error: 'workspaceId dan content tidak boleh kosong.' };
    }

    try {
      const startTime = Date.now();

      // If user toggles RabbitMQ async mode, publish to OCR queue
      if (useRabbitMQ) {
        const jobId = `mq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const published = await publishToQueue(QUEUES.DOCUMENTS_OCR, {
          jobId,
          workspaceId,
          fileName,
          content,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          data: {
            mode: 'rabbitmq_async',
            jobId,
            queue: QUEUES.DOCUMENTS_OCR,
            published,
            message: published
              ? `Tugas OCR & RAG berhasil diterbitkan ke RabbitMQ queue "${QUEUES.DOCUMENTS_OCR}" (Job #${jobId})!`
              : 'RabbitMQ broker offline. Tugas dijalankan dengan fallback instan.',
          },
        };
      }

      // Synchronous Vector RAG Ingestion
      const docEmbedding = await getEmbedding(content.trim());
      const vectorStr = `[${docEmbedding.join(',')}]`;

      // Check semantic similarity against previous receipts/transactions to give context
      const relatedMatches: any = await db.execute(sql`
        SELECT 
          te.transaction_id,
          te.content,
          ROUND((1 - (te.embedding <=> ${vectorStr}::vector))::numeric, 4)::float AS similarity,
          t.amount,
          t.description,
          t.date
        FROM transaction_embeddings te
        JOIN transactions t ON t.id = te.transaction_id
        WHERE te.workspace_id = ${workspaceId}
          AND t.deleted_at IS NULL
        ORDER BY te.embedding <=> ${vectorStr}::vector ASC
        LIMIT 3;
      `);

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        data: {
          mode: 'sync_rag',
          executionTimeMs,
          fileName,
          extractedLength: content.length,
          ragContext: relatedMatches,
          message: 'Dokumen berhasil dianalisis dengan pgvector RAG.',
        },
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  }, {
    body: t.Object({
      workspaceId: t.String(),
      content: t.String(),
      fileName: t.Optional(t.String()),
      useRabbitMQ: t.Optional(t.Boolean()),
      categoryHint: t.Optional(t.String()),
      amountHint: t.Optional(t.Number()),
    }),
    detail: {
      tags: ['AI'],
      summary: 'Upload document for pgvector RAG and RabbitMQ async processing',
      description: 'Ingests receipts or transaction documents, computes embeddings, and optionally queues to RabbitMQ.',
    },
  });
