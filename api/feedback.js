const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbym7vyV373z2q2H_222mFYnKoAXzK50i4rZ7poFya4L4v571X4ZYeZ1hqSuityoNoLNtg/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || !body.discipline || !Array.isArray(body.selections) || body.selections.length === 0) {
      return res.status(400).json({ success: false, error: "Discipline and at least one selection are required." });
    }
    if (body.selections.length > 50) {
      return res.status(400).json({ success: false, error: "Too many terms in one submission." });
    }

    const payload = {
      discipline: String(body.discipline).trim().slice(0, 120),
      comment: String(body.comment || "").trim().slice(0, 1000),
      selections: body.selections.map(item => ({
        article: String(item.article || "").trim().slice(0, 20),
        word: String(item.word || "").trim().slice(0, 180)
      })).filter(item => item.article && item.word)
    };

    if (!payload.discipline || payload.selections.length === 0) {
      return res.status(400).json({ success: false, error: "No valid terminology suggestions received." });
    }

    const googleResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const raw = await googleResponse.text();
    let result;
    try { result = JSON.parse(raw); }
    catch { throw new Error("Google Apps Script returned an invalid response."); }

    if (!googleResponse.ok || !result.success) {
      throw new Error(result.error || `Google Apps Script returned ${googleResponse.status}.`);
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(result);
  } catch (error) {
    console.error("Feedback submission failed:", error);
    return res.status(502).json({ success: false, error: "The feedback service could not submit this response." });
  }
}
