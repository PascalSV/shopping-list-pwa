-- Remove duplicate lists (keep only the one with the latest updated_at per name)
-- First, identify which list IDs to keep (the ones with max updated_at for each name)
-- Then delete all other IDs with the same name

-- Temporarily disable foreign key checks
PRAGMA foreign_keys = OFF;

-- Delete items from lists that will be deleted
DELETE FROM items 
WHERE list_id IN (
    SELECT l1.id FROM lists l1
    INNER JOIN lists l2 ON l1.name = l2.name
    WHERE l1.id != l2.id AND l1.updated_at < l2.updated_at
);

-- Delete duplicate lists, keeping only the one with max updated_at per name
DELETE FROM lists 
WHERE id IN (
    SELECT l1.id FROM lists l1
    INNER JOIN lists l2 ON l1.name = l2.name
    WHERE l1.id != l2.id AND l1.updated_at < l2.updated_at
);

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

