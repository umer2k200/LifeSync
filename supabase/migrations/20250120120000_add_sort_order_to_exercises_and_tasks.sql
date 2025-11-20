-- Add manual ordering support to exercises and tasks

ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ordered_exercises AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY workout_id ORDER BY created_at, id) - 1 AS rn
  FROM exercises
  WHERE sort_order IS NULL
)
UPDATE exercises e
SET sort_order = ordered_exercises.rn
FROM ordered_exercises
WHERE ordered_exercises.id = e.id;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ordered_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1 AS rn
  FROM tasks
  WHERE sort_order IS NULL
)
UPDATE tasks t
SET sort_order = ordered_tasks.rn
FROM ordered_tasks
WHERE ordered_tasks.id = t.id;

