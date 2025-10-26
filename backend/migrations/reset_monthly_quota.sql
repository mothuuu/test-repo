-- Reset monthly scan quota for all users
-- Run this script when you need to reset scan counts

-- Show current quota usage before reset
SELECT id, email, plan, scans_used_this_month
FROM users
ORDER BY id;

-- Reset all users' monthly scan count to 0
UPDATE users
SET scans_used_this_month = 0;

-- Show updated quota usage after reset
SELECT id, email, plan, scans_used_this_month
FROM users
ORDER BY id;

-- Confirmation message
SELECT 'Monthly scan quota reset successfully for all users!' as message;
