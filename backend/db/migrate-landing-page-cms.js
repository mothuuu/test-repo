const db = require('./database');

async function migrateLandingPageCMS() {
  console.log('🚀 Starting landing page CMS migration...');

  try {
    // Create landing_page_content table with JSONB for flexible content storage
    await db.query(`
      CREATE TABLE IF NOT EXISTS landing_page_content (
        id SERIAL PRIMARY KEY,
        section_key VARCHAR(50) UNIQUE NOT NULL,
        content JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Created landing_page_content table');

    // Insert default content for all sections
    const defaultContent = [
      {
        section_key: 'hero',
        content: {
          alertBadge: '⚠️ 94% of websites are invisible to AI search engines',
          heading: 'Is Your Website Invisible to AI?',
          subtitle: 'ChatGPT, Perplexity, and Claude answer millions of searches daily—but they\'re NOT recommending your business. Get your free AI Visibility Score in 30 seconds and discover exactly what\'s blocking you.',
          trustBadges: [
            { icon: '✓', text: 'Free scan • No signup required' },
            { icon: '⚡', text: 'Results in 30 seconds' },
            { icon: '💳', text: 'No credit card needed' }
          ]
        }
      },
      {
        section_key: 'stats',
        content: {
          stats: [
            { number: '1,247', label: 'Sites Analyzed' },
            { number: '+340', label: 'Avg Score Improvement' },
            { number: '94%', label: 'Need Critical Fixes' },
            { number: '4.9★', label: 'Customer Rating' }
          ]
        }
      },
      {
        section_key: 'problem',
        content: {
          badge: 'Critical Shift',
          title: 'Traditional SEO Doesn\'t Work for AI',
          subtitle: 'Traditional SEO is dead. AI search engines like ChatGPT, Perplexity, and Claude use completely different ranking signals. If you\'re not optimized for AI, you\'re invisible.',
          problems: [
            {
              icon: '🔍',
              title: 'How Users Find You',
              oldWay: '❌ Google ranks 10 blue links based on backlinks and keywords',
              newWay: '✓ AI recommends 1 answer based on content quality and structure'
            },
            {
              icon: '📊',
              title: 'What Gets You Ranked',
              oldWay: '❌ Keywords, meta tags, and backlinks matter most',
              newWay: '✓ Context, readability, domain authority and semantic understanding drive visibility'
            },
            {
              icon: '⚡',
              title: 'Speed of Change',
              oldWay: '❌ Rankings update weekly or monthly based on crawl cycles',
              newWay: '✓ AI makes real-time decisions on every single query'
            }
          ]
        }
      },
      {
        section_key: 'pillars',
        content: {
          badge: 'AI-First Framework',
          title: 'What We Analyze (And Fix)',
          subtitle: 'Our scoring engine evaluates multiple critical categories that directly impact your brand\'s AI visibility. We identify every gap keeping AI search engines from finding and recommending you—and gives you step-by-step instructions to fix each issue. No technical expertise required.\n\nNo guesswork. No jargon. Just clear actions you can implement today.',
          pillars: [
            {
              icon: '🤖',
              title: 'AI Readability',
              boost: '+125 pts',
              description: 'Make your content instantly parseable by AI engines through alt text, transcripts, and multimodal optimization'
            },
            {
              icon: '🎯',
              title: 'Search Readiness',
              boost: '+200 pts',
              description: 'Optimize for how AI answers questions with FAQ format, scannability, and snippet-ready content'
            },
            {
              icon: '📅',
              title: 'Content Freshness',
              boost: '+80 pts',
              description: 'Signal recency with timestamps, update indicators, and IndexNow protocol for instant AI updates'
            },
            {
              icon: '📝',
              title: 'Content Structure',
              boost: '+150 pts',
              description: 'Build hierarchy with semantic HTML, proper headings, and clear information architecture'
            },
            {
              icon: '⚡',
              title: 'Speed & UX',
              boost: '+50 pts',
              description: 'AI crawlers prioritize fast sites—optimize load times and mobile experience'
            },
            {
              icon: '⚙️',
              title: 'Technical Setup',
              boost: '+180 pts',
              description: 'Implement schema markup, structured data, and proper meta tags for AI comprehension'
            },
            {
              icon: '🛡️',
              title: 'Trust & Authority',
              boost: '+120 pts',
              description: 'Build credibility signals through author bios, certifications, and third-party validation'
            },
            {
              icon: '🎤',
              title: 'Voice Optimization',
              boost: '+120 pts',
              description: 'Capture conversational queries with natural language and question-based content'
            }
          ]
        }
      },
      {
        section_key: 'how_it_works',
        content: {
          badge: 'How It Works',
          title: 'Get Your Score in 3 Simple Steps',
          subtitle: 'No technical knowledge required. We handle the complexity—you get actionable insights.',
          steps: [
            {
              icon: '🔗',
              title: 'Enter Your URL',
              description: 'Simply paste your website URL. No signup required for your first scan.'
            },
            {
              icon: '🔬',
              title: 'We Analyze 47 Factors',
              description: 'Our engine scans your site across 8 categories, evaluating AI readiness in 30 seconds.'
            },
            {
              icon: '📊',
              title: 'Get Actionable Fixes',
              description: 'Receive prioritized recommendations with step-by-step instructions and expected score gains.'
            }
          ]
        }
      },
      {
        section_key: 'testimonials',
        content: {
          badge: 'Trusted By Leaders',
          title: 'Real Results from Real Businesses',
          testimonials: [
            {
              stars: 5,
              text: 'Increased our AI visibility score from 420 to 780 in 3 weeks. Now ChatGPT recommends us in 6 out of 10 relevant queries. Game changer.',
              authorInitials: 'SM',
              authorName: 'Sarah Mitchell',
              authorTitle: 'CMO, TechVision MSP'
            },
            {
              stars: 5,
              text: 'The recommendations were so specific and actionable. We implemented the top 5 fixes and saw immediate improvements in how AI tools surfaced our content.',
              authorInitials: 'JC',
              authorName: 'James Chen',
              authorTitle: 'Founder, CloudSecure'
            },
            {
              stars: 5,
              text: 'Finally, a tool that bridges the gap between traditional SEO and AI optimization. The category breakdown made it crystal clear where to focus.',
              authorInitials: 'LR',
              authorName: 'Lakshmi R.',
              authorTitle: 'CEO, Idril Services',
              authorUrl: 'https://idrilservices.io/'
            }
          ],
          resultsShowcase: {
            heading: 'Average Results After Implementation',
            subtitle: 'Based on 847 businesses that implemented our recommendations',
            results: [
              { number: '+340', label: 'Average Score Increase' },
              { number: '3.2x', label: 'More AI Recommendations' },
              { number: '67%', label: 'See Results in 2 Weeks' }
            ]
          }
        }
      },
      {
        section_key: 'final_cta',
        content: {
          heading: 'See Your AI Visibility Score Now',
          subtitle: 'Join 1,200+ businesses already optimizing for AI search engines. Free scan in 30 seconds.',
          checklist: [
            'No signup required for first scan',
            'See exactly what AI engines see',
            'Get 5 priority fixes instantly',
            'Compare against competitors'
          ]
        }
      },
      {
        section_key: 'footer',
        content: {
          text: 'Powered by Xeo AI Hub & Xeo Marketing',
          copyright: '© 2025 AI Visibility Score. All rights reserved.',
          xeoMarketingUrl: 'https://xeo.marketing/'
        }
      }
    ];

    // Insert or update content
    for (const item of defaultContent) {
      await db.query(
        `INSERT INTO landing_page_content (section_key, content, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (section_key)
         DO UPDATE SET content = $2, updated_at = CURRENT_TIMESTAMP`,
        [item.section_key, JSON.stringify(item.content)]
      );
    }
    console.log('✅ Inserted default landing page content');

    console.log('✅ Landing page CMS migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateLandingPageCMS()
    .then(() => {
      console.log('Migration complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateLandingPageCMS };
