-- Custom SQL migration file --
INSERT INTO "fdm"."animal_category_catalogue_selecting" ("b_id_farm", "l_category_source") SELECT "b_id_farm", 'rvo' FROM "fdm"."farms" ON CONFLICT DO NOTHING;