const express = require('express');
const router = express.Router();
const db = require('../../db/database');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// GET all landing page content or specific section
// /api/admin/cms/content?section=hero (optional)
router.get('/content', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { section } = req.query;

    if (section) {
      // Get specific section
      const result = await db.query(
        'SELECT section_key, content, updated_at FROM landing_page_content WHERE section_key = $1',
        [section]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Section not found' });
      }

      res.json({
        success: true,
        section: result.rows[0]
      });
    } else {
      // Get all sections
      const result = await db.query(
        'SELECT section_key, content, updated_at FROM landing_page_content ORDER BY section_key'
      );

      const sections = {};
      result.rows.forEach(row => {
        sections[row.section_key] = {
          content: row.content,
          updated_at: row.updated_at
        };
      });

      res.json({
        success: true,
        sections
      });
    }
  } catch (error) {
    console.error('Error fetching CMS content:', error);
    res.status(500).json({ error: 'Failed to fetch CMS content' });
  }
});

// PUT update specific section
// /api/admin/cms/content/:section
router.put('/content/:section', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { section } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Validate that section exists
    const existingSection = await db.query(
      'SELECT id FROM landing_page_content WHERE section_key = $1',
      [section]
    );

    if (existingSection.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Update the section content
    await db.query(
      `UPDATE landing_page_content
       SET content = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2
       WHERE section_key = $3`,
      [JSON.stringify(content), req.user.userId, section]
    );

    res.json({
      success: true,
      message: 'Section updated successfully',
      section,
      updated_at: new Date()
    });
  } catch (error) {
    console.error('Error updating CMS content:', error);
    res.status(500).json({ error: 'Failed to update CMS content' });
  }
});

// GET public endpoint for landing page content (no auth required)
router.get('/public/content', async (req, res) => {
  try {
    const { section } = req.query;

    if (section) {
      // Get specific section
      const result = await db.query(
        'SELECT content FROM landing_page_content WHERE section_key = $1',
        [section]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Section not found' });
      }

      res.json({
        success: true,
        content: result.rows[0].content
      });
    } else {
      // Get all sections
      const result = await db.query(
        'SELECT section_key, content FROM landing_page_content ORDER BY section_key'
      );

      const sections = {};
      result.rows.forEach(row => {
        sections[row.section_key] = row.content;
      });

      res.json({
        success: true,
        sections
      });
    }
  } catch (error) {
    console.error('Error fetching public CMS content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

module.exports = router;
