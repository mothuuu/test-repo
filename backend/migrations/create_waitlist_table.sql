-- Create waitlist table for Premium and Agency tier signups
CREATE TABLE IF NOT EXISTS waitlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    plan VARCHAR(50) NOT NULL CHECK (plan IN ('premium', 'pro', 'agency')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    website VARCHAR(255),
    current_plan VARCHAR(50),
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    notified_at TIMESTAMP,
    UNIQUE(email, plan)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_plan ON waitlist(plan);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- Add comment
COMMENT ON TABLE waitlist IS 'Stores users who have joined the waitlist for Premium and Agency plans';
