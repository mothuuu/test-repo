/**
 * Executive Summary Generator
 * AI-powered executive-friendly competitive analysis summary
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate executive summary using AI
 * @param {Object} primaryScan - Primary domain scan
 * @param {Array} competitorScans - Array of competitor scans
 * @param {Object} gapAnalysis - Gap analysis results
 * @param {Object} competitiveRecs - Competitive recommendations
 * @returns {String} Executive summary
 */
async function generateExecutiveSummary(primaryScan, competitorScans, gapAnalysis, competitiveRecs) {
  console.log('📝 Generating AI-powered executive summary...');

  try {
    // Prepare data for AI
    const primaryDomain = primaryScan.extracted_domain;
    const primaryScore = primaryScan.total_score;
    const competitorData = competitorScans.map(c => ({
      domain: c.extracted_domain,
      score: c.total_score,
      gap: primaryScore - c.total_score
    }));

    const rank = gapAnalysis.rank_position;
    const totalCompetitors = competitorScans.length + 1;
    const categoriesAhead = gapAnalysis.categories_ahead.length;
    const categoriesBehind = gapAnalysis.categories_behind.length;
    const biggestGaps = gapAnalysis.biggest_opportunities.slice(0, 3);
    const topRecommendations = competitiveRecs.recommendations.slice(0, 3);
    const quickWins = competitiveRecs.quick_wins.length;

    // Create prompt for AI
    const prompt = `You are a strategic business analyst writing an executive summary of a competitive AI visibility analysis. Write a concise, executive-friendly summary (3-4 paragraphs) that covers:

**Context:**
- Primary Domain: ${primaryDomain}
- AI Visibility Score: ${primaryScore}/1000
- Competitive Rank: #${rank} out of ${totalCompetitors}
- Leading in ${categoriesAhead} categories, trailing in ${categoriesBehind} categories

**Competitors:**
${competitorData.map(c => `- ${c.domain}: ${c.score}/1000 (${c.gap >= 0 ? '+' : ''}${c.gap} points)`).join('\n')}

**Biggest Gaps:**
${biggestGaps.map(g => `- ${g.category}: Behind by ${Math.round(g.gap)} points`).join('\n')}

**Top Recommendations:**
${topRecommendations.map((r, i) => `${i + 1}. ${r.title} (${r.estimated_impact} impact, ${r.estimated_effort} effort)`).join('\n')}

**Quick Wins Available:** ${quickWins}

**Writing Guidelines:**
- Tone: Executive-friendly, direct, actionable
- Style: Clear, professional, focused on business impact
- Length: 3-4 paragraphs (300-400 words)
- Focus: Key takeaway → Competitive position → Critical actions → Expected outcome

Start with: "Key Takeaway:" and make it compelling.

DO NOT use generic phrases. Be specific with numbers, domains, and actionable insights.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a strategic business analyst who writes clear, actionable executive summaries focused on competitive positioning and business outcomes. You avoid jargon and focus on what matters: competitive standing, specific gaps, and clear next steps.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const summary = response.choices[0].message.content.trim();
    console.log('✅ Executive summary generated');

    return summary;

  } catch (error) {
    console.error('❌ Error generating executive summary:', error.message);

    // Fallback to template-based summary if AI fails
    return generateFallbackSummary(primaryScan, competitorScans, gapAnalysis, competitiveRecs);
  }
}

/**
 * Fallback template-based summary if AI generation fails
 */
function generateFallbackSummary(primaryScan, competitorScans, gapAnalysis, competitiveRecs) {
  const primaryDomain = primaryScan.extracted_domain;
  const primaryScore = primaryScan.total_score;
  const rank = gapAnalysis.rank_position;
  const totalCompetitors = competitorScans.length + 1;
  const categoriesAhead = gapAnalysis.categories_ahead.length;
  const categoriesBehind = gapAnalysis.categories_behind.length;
  const biggestGap = gapAnalysis.biggest_opportunities[0];
  const topRec = competitiveRecs.recommendations[0];
  const quickWins = competitiveRecs.quick_wins.length;

  let positionContext = '';
  if (rank === 1) {
    positionContext = `${primaryDomain} currently leads the competitive set with an AI Visibility Score of ${primaryScore}/1000. The focus should be on maintaining this leadership position while continuing to innovate and improve across all categories.`;
  } else if (rank === 2) {
    const leader = competitorScans.find(c => c.total_score > primaryScore);
    const gap = leader.total_score - primaryScore;
    positionContext = `${primaryDomain} ranks #2 with a score of ${primaryScore}/1000, trailing ${leader.extracted_domain} by ${gap} points. The competitive gap is closable with focused execution on high-priority improvements.`;
  } else {
    const leader = [...competitorScans].sort((a, b) => b.total_score - a.total_score)[0];
    const gap = leader.total_score - primaryScore;
    positionContext = `${primaryDomain} currently ranks #${rank} out of ${totalCompetitors} competitors with a score of ${primaryScore}/1000. There is a ${gap}-point gap to the market leader, ${leader.extracted_domain}.`;
  }

  let strengthsContext = '';
  if (categoriesAhead > 0) {
    const topCategories = gapAnalysis.categories_ahead.slice(0, 2).map(c => c.category).join(' and ');
    strengthsContext = `Your site leads in ${categoriesAhead} categories, with particular strength in ${topCategories}. `;
  }

  const gapContext = `However, there are significant opportunities in ${categoriesBehind} categories. The most critical gap is in ${biggestGap?.category || 'key areas'}, where you trail by ${Math.round(biggestGap?.gap || 0)} points. ${topRec?.what_competitor_does_better || ''}`;

  const actionContext = `The analysis identifies ${quickWins} quick-win opportunities that can be implemented in 1-2 weeks with immediate impact. Priority actions include: ${topRec?.title || 'addressing technical and content gaps'}. Implementing the recommended roadmap could improve your overall score by ${Math.round(Math.abs(gapAnalysis.overall_score_gap) * 0.6)}+ points over 2-3 months, ${rank > 1 ? `potentially moving you to #${Math.max(1, rank - 1)} position` : 'solidifying your leadership position'}.`;

  return `**Key Takeaway:** ${positionContext}

${strengthsContext}${gapContext}

${actionContext}`;
}

module.exports = {
  generateExecutiveSummary
};
