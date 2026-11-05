-- ==============================================================================
-- 20261011000002_seed.sql
-- Initial Contest State & Starter Questions Seed
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INITIAL CONTEST STATE
-- Ensure the singleton contest_state row exists in 'not_started' status.
-- ------------------------------------------------------------------------------
INSERT INTO public.contest_state (
    id,
    status,
    ends_at,
    paused_remaining_seconds,
    leaderboard_frozen,
    current_broadcast
)
VALUES (
    1,
    'not_started',
    NULL,
    NULL,
    false,
    NULL
)
ON CONFLICT (id) DO UPDATE
SET updated_at = now();

-- ------------------------------------------------------------------------------
-- 2. STARTER QUESTION 1: "Reverse Words in a String"
-- ------------------------------------------------------------------------------
INSERT INTO public.questions (
    id,
    title,
    description,
    input_data,
    max_points,
    order_index,
    status,
    tier,
    category,
    is_bonus
)
VALUES (
    '11111111-1111-1111-1111-111111111111'::UUID,
    'Reverse Words in a String',
    'Write a prompt that instructs Gemini to generate JavaScript code that takes a string input and reverses the characters of each individual word while preserving original word order and spacing.',
    'Hello World from Vibe Coding',
    100,
    1,
    'live',
    'EASY',
    'STRING_MANIPULATION',
    false
)
ON CONFLICT (id) DO UPDATE
SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    input_data = EXCLUDED.input_data,
    max_points = EXCLUDED.max_points;

-- Secret expected output for Question 1 (accessible ONLY by admins and service_role)
INSERT INTO public.question_secrets (
    question_id,
    expected_output
)
VALUES (
    '11111111-1111-1111-1111-111111111111'::UUID,
    'olleH dlroW morf gnidoC ebiV'
)
ON CONFLICT (question_id) DO UPDATE
SET expected_output = EXCLUDED.expected_output;

-- ------------------------------------------------------------------------------
-- 3. STARTER QUESTION 2: "Deep JSON Number Sum"
-- ------------------------------------------------------------------------------
INSERT INTO public.questions (
    id,
    title,
    description,
    input_data,
    max_points,
    order_index,
    status,
    tier,
    category,
    is_bonus
)
VALUES (
    '22222222-2222-2222-2222-222222222222'::UUID,
    'Deep JSON Number Sum',
    'Write a prompt that instructs Gemini to generate JavaScript code to recursively traverse an arbitrary nested JSON object/array structure and calculate the sum of all numerical values encountered (ignoring non-numeric strings and keys). Return the final sum as a string.',
    '{"a": 10, "b": {"c": 20, "d": [5, 15]}, "e": "ignore", "f": {"g": {"h": 50}}}',
    100,
    2,
    'live',
    'MEDIUM',
    'RECURSION',
    false
)
ON CONFLICT (id) DO UPDATE
SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    input_data = EXCLUDED.input_data,
    max_points = EXCLUDED.max_points;

-- Secret expected output for Question 2 (accessible ONLY by admins and service_role)
INSERT INTO public.question_secrets (
    question_id,
    expected_output
)
VALUES (
    '22222222-2222-2222-2222-222222222222'::UUID,
    '100'
)
ON CONFLICT (question_id) DO UPDATE
SET expected_output = EXCLUDED.expected_output;

