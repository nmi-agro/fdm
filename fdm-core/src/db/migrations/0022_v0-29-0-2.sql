UPDATE "fdm"."fields"
SET "b_bufferstrip" = COALESCE(
    (
        ST_Length(ST_ExteriorRing(b_geometry)::geography) / NULLIF(SQRT(ST_Area(b_geometry::geography)), 0) >= 20
        AND ST_Area(b_geometry::geography) < 25000
    ),
    FALSE
)
OR b_name ILIKE '%buffer%';
