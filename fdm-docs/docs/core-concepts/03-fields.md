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

## Start and End Dates

`b_end` is the **last day the field is managed**, inclusive. It is interpreted as a calendar date in the Europe/Amsterdam time zone and stored as the end of that day (`23:59:59.999` Europe/Amsterdam).

Users end a field at the turn of the year in two ways: on 31 December ("the last day I manage it") or on 1 January ("I stop managing it from this date"). Both mean the same thing, so an end date on 1 January is stored as the end of 31 December of the previous year. For example, `2025-12-31` and `2026-01-01` both result in a field that is managed up to and including 31 December 2025, and is not part of calendar year 2026.

`addField` and `updateField` apply this normalisation automatically (see `normalizeEndDate`). When `getFields` is called with a timeframe, it returns the fields that are managed during at least part of that timeframe: fields with `b_start` on or before the end of the timeframe, and with no `b_end` or a `b_end` on or after the start of the timeframe. Build calendar-year timeframes from 1 January 00:00 to 31 December 23:59:59.999 in Europe/Amsterdam, for example with `startOfDayInFdmTimeZone`.

## Role in Tracking Activities

The `Field` asset plays a crucial role in tracking location-specific activities. Actions such as sowing (`cultivationStarting`) and fertilizing (`fertilizerApplication`) are directly linked to the `field`. Other activities, such as harvesting (`cultivationHarvesting`), are linked to the `cultivation` which is growing on the field, thereby creating an indirect link to the field.

This interconnected data structure allows you to build a complete history of all activities that have taken place on a specific field, which is essential for traceability, compliance, and precision agriculture.
