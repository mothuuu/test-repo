const jwt = require('jsonwebtoken');
const db = require('../db/database');

/**
 * Admin Authentication Middleware
 * Verifies JWT token and checks for admin role
 */
async function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('[Admin Auth] No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user with role
    const result = await db.query(
      `SELECT id, email, name, role, plan, email_verified,
              scans_used_this_month, competitor_scans_used_this_month,
              primary_domain, stripe_customer_id, industry, industry_custom,
              created_at, last_login, last_ip, last_login_location
       FROM users
       WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      console.log('[Admin Auth] User not found');
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if user has admin role
    const adminRoles = ['super_admin', 'content_manager', 'system_admin', 'support_agent', 'analyst'];
    if (!adminRoles.includes(user.role)) {
      console.log(`[Admin Auth] Access denied for user ${user.email} with role: ${user.role || 'user'}`);
      return res.status(403).json({
        error: 'Admin access required',
        message: 'You do not have permission to access this resource'
      });
    }

    // Log admin access for audit trail
    await logAdminAccess(user, req);

    // Attach user to request
    req.user = user;
    req.adminRole = user.role;

    console.log(`[Admin Auth] Access granted for ${user.email} (${user.role})`);
    next();
  } catch (error) {
    console.error('[Admin Auth] Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Super Admin Only Middleware
 * Only allows super_admin role
 */
async function authenticateSuperAdmin(req, res, next) {
  await authenticateAdmin(req, res, async () => {
    if (req.user.role !== 'super_admin') {
      console.log(`[Super Admin Auth] Access denied for ${req.user.email} (${req.user.role})`);
      return res.status(403).json({
        error: 'Super Admin access required',
        message: 'This action requires Super Admin permissions'
      });
    }
    next();
  });
}

/**
 * Content Manager or Super Admin Middleware
 * Allows content_manager and super_admin roles
 */
async function authenticateContentManager(req, res, next) {
  await authenticateAdmin(req, res, async () => {
    const allowedRoles = ['super_admin', 'content_manager'];
    if (!allowedRoles.includes(req.user.role)) {
      console.log(`[Content Manager Auth] Access denied for ${req.user.email} (${req.user.role})`);
      return res.status(403).json({
        error: 'Content Manager access required',
        message: 'This action requires Content Manager or Super Admin permissions'
      });
    }
    next();
  });
}

/**
 * Check Specific Permission
 * Allows different roles based on permission type
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    await authenticateAdmin(req, res, async () => {
      const permissions = getPermissionsForRole(req.user.role);

      if (!permissions.includes(permission)) {
        console.log(`[Permission Check] ${req.user.email} lacks permission: ${permission}`);
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Your role (${req.user.role}) does not have permission to: ${permission}`
        });
      }
      next();
    });
  };
}

/**
 * Get permissions for each role
 */
function getPermissionsForRole(role) {
  const rolePermissions = {
    super_admin: [
      // Full access to everything
      'view_all_users',
      'edit_users',
      'delete_users',
      'upgrade_users',
      'downgrade_users',
      'view_revenue',
      'manage_billing',
      'view_all_scans',
      'delete_scans',
      'view_recommendations',
      'edit_recommendations',
      'delete_recommendations',
      'curate_recommendations',
      'train_ai',
      'view_analytics',
      'export_data',
      'manage_admins',
      'view_audit_log',
      'system_config',
      'api_management',
      'email_campaigns',
      'impersonate_user',
      'manage_content'
    ],
    content_manager: [
      // Content and recommendation management
      'view_all_users', // view only
      'view_all_scans', // view only
      'view_recommendations',
      'edit_recommendations',
      'curate_recommendations',
      'train_ai',
      'view_analytics', // limited
      'email_campaigns',
      'export_data', // limited
      'manage_content'
    ],
    system_admin: [
      // Technical operations
      'view_all_users',
      'edit_users', // no delete
      'view_all_scans',
      'view_recommendations', // view only
      'view_analytics', // technical only
      'export_data', // limited
      'system_config',
      'api_management'
    ],
    support_agent: [
      // Customer support
      'view_all_users',
      'view_all_scans',
      'view_recommendations',
      'impersonate_user'
    ],
    analyst: [
      // Read-only analytics
      'view_analytics',
      'export_data'
    ]
  };

  return rolePermissions[role] || [];
}

/**
 * Log admin access for audit trail
 */
async function logAdminAccess(user, req) {
  try {
    // Get IP address
    const ip = req.headers['x-forwarded-for'] ||
                req.headers['x-real-ip'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                'unknown';

    // Get user agent
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Update last login info
    await db.query(
      `UPDATE users
       SET last_login = NOW(),
           last_ip = $1
       WHERE id = $2`,
      [ip, user.id]
    );

    // Note: Full audit logging happens in the route handlers for specific actions
  } catch (error) {
    console.error('[Admin Auth] Failed to log admin access:', error);
    // Don't fail the request if logging fails
  }
}

/**
 * Create audit log entry
 * Call this from route handlers for important actions
 */
async function createAuditLog(admin, action, entityType, entityId, description, changes = {}, metadata = {}) {
  try {
    await db.query(
      `INSERT INTO audit_log
       (admin_id, admin_email, admin_role, action, entity_type, entity_id, description, changes, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        admin.id,
        admin.email,
        admin.role,
        action,
        entityType,
        entityId,
        description,
        JSON.stringify(changes),
        JSON.stringify(metadata),
        admin.last_ip || 'unknown',
        'admin-panel'
      ]
    );
    console.log(`[Audit Log] ${admin.email} - ${action} on ${entityType}:${entityId}`);
  } catch (error) {
    console.error('[Audit Log] Failed to create audit log:', error);
  }
}

module.exports = {
  authenticateAdmin,
  authenticateSuperAdmin,
  authenticateContentManager,
  requirePermission,
  getPermissionsForRole,
  createAuditLog
};
