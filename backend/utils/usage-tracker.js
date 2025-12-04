class UsageTracker {
  constructor(dbClient) {
    this.db = dbClient;
  }

  async incrementUsage(userId, { isCompetitor = false } = {}) {
    if (!userId) return null;

    const column = isCompetitor
      ? 'competitor_scans_used_this_month'
      : 'scans_used_this_month';

    const result = await this.db.query(
      `UPDATE users
       SET ${column} = COALESCE(${column}, 0) + 1
       WHERE id = $1
       RETURNING scans_used_this_month, competitor_scans_used_this_month`,
      [userId]
    );

    return result.rows[0];
  }
}

module.exports = UsageTracker;
