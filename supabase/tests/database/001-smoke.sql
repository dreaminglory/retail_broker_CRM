BEGIN;
SELECT plan(1);

SELECT pass('smoke test passes');

SELECT * FROM finish();
ROLLBACK;
