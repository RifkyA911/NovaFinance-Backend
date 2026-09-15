import { Elysia, t } from 'elysia';

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

      const prompt = `Anda adalah NovaJournal AI Financial Advisor profesional. Analisis data finansial berikut secara analitis dan berikan kesimpulan tajam serta rekomendasi konkret dalam Bahasa Indonesia:
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

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn('Gemini API call returned status:', response.status);
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
  });
