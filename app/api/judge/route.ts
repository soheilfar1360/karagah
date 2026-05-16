export async function GET() {
  return Response.json({
    ok: true,
    message: "Judge API works on Cloudflare OpenNext",
  });
}

export async function POST() {
  return Response.json({
    total: 100,
    breakdown: {
      killer: 20,
      suspect: 20,
      motive: 15,
      method: 15,
      timeline: 20,
      evidence: 20,
      elimination: 10,
    },
    feedback: "تست موفق بود.",
    correctEvidence: [],
    missedEvidence: [],
  });
}