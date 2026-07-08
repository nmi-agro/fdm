---
title: Fields
---

The `Field` asset is the primary spatial asset in the Farm Data Model (FDM). It represents a specific area of land where agricultural activities take place.

## Geometric Properties

A `Field` has a `b_geometry` property that stores its geometric information as a GeoJSON polygon. This allows you to represent the exact shape and location of the field on a map.

The geometry is stored in the [WGS 84](https://en.wikipedia.org/wiki/World_Geodetic_System#WGS_84) coordinate system (SRID 4326), which is the standard for GPS and web mapping.

## Properties

A `Field` has the following properties, which are stored in the `fields` table:

- **`b_id`**: A unique identifier for the field. This is the primary key for the `fields` table.
- **`b_name`**: The name of the field.
- **`b_geometry`**: The geometry of the field, as a GeoJSON polygon.
- **`b_id_source`**: An optional identifier from an external data source.

## Relationship to a Farm

A `Field` is always associated with a `Farm`. This relationship is established through the `fieldAcquiring` table, which links a `field` (`b_id`) to a `farm` (`b_id_farm`). This table also records:

- **`b_start`**: The date when the farm's management of the field began.
- **`b_acquiring_method`**: The method by which the farm acquired the field (e.g., ownership, lease).

The `fieldDiscarding` table is used to mark when a field is no longer actively managed by the farm.

## Role in Tracking Activities

The `Field` asset plays a crucial role in tracking location-specific activities. Actions such as sowing (`cultivationStarting`) and fertilizing (`fertilizerApplication`) are directly linked to the `field`. Other activities, such as harvesting (`cultivationHarvesting`), are linked to the `cultivation` which is growing on the field, thereby creating an indirect link to the field.

This interconnected data structure allows you to build a complete history of all activities that have taken place on a specific field, which is essential for traceability, compliance, and precision agriculture.
