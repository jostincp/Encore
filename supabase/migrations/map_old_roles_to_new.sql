-- Map old roles to new unified roles
-- SUPER_ADMIN -> admin
-- MEMBER      -> user
-- customer    -> user

UPDATE users
SET role = 'admin'
WHERE role IN ('SUPER_ADMIN', 'super_admin');

UPDATE users
SET role = 'user'
WHERE role IN ('MEMBER', 'member', 'customer');

-- Ensure roles adhere to new constraint set
-- Valid roles: guest, user, staff, bar_owner, admin
-- No-op for other values; consider logging externally if needed