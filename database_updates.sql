-- ============================================================
-- Giggly Paws — User Approval Feature Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add is_approved column to users table
--    Existing users (including super-admin) are approved by default (true)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true;

-- 2. Add auto_approve_users column to store_settings table
--    Default: true (auto-approve = on, matches existing behavior)
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_approve_users BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- That's it!
--
-- How it works:
--   - In Settings > General: toggle "Auto-Approve New Users"
--       ON  → new users added by admin can log in immediately
--       OFF → new users are set is_approved=false and must wait
--             for admin to approve in the Users page
--
--   - In Users page: pending users show an amber banner + Approve/Reject buttons
--   - At Login: correct PIN but is_approved=false shows "Awaiting Approval" screen
--   - ADMIN role and super-admin are NEVER blocked regardless of is_approved
-- ============================================================
