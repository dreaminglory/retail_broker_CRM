-- spec: property-import, rule 4, review fix (20261109000007). The address key keeps two numbers
-- that the address separates apart, so `Яворов 1, 23` and `Яворов 12, 3` are different
-- properties, while punctuation, street words and spacing still don't matter.
BEGIN;
SELECT plan(5);

SELECT isnt(
  property_address_key('ул. Яворов 1, 23'), property_address_key('ул. Яворов 12, 3'),
  'Numbers split differently give different keys'
);
SELECT is(property_address_key('ул. Яворов 1, 23'), 'яворов1/23', 'Two separated numbers keep a separator');
SELECT is(
  property_address_key('ул. Яворов 1, 23'), property_address_key('Яворов 1 23'),
  'A comma or a space between the numbers is the same'
);
SELECT is(
  property_address_key('ул. "Яворов" № 12, ет. 3'), property_address_key('ул Яворов 12 ет 3'),
  'A number next to a word still joins it'
);
SELECT is(
  (SELECT count(*)::INT FROM properties WHERE address_key IS DISTINCT FROM property_address_key(address)),
  0,
  'Every stored key is the current rule'
);

SELECT * FROM finish();
ROLLBACK;
