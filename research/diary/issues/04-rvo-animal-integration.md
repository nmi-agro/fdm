# [fdm-rvo / fdm-core] RVO animal integration — retrieve & ingest animal details

**Epic:** D — RVO animal integration · **Depends on:** 01 (fdm-core `animals`/`animal_arriving`/`animal_leaving`/`herds` schema, for the ingestion half) · **Milestone:** RVO integration

## Background

This single issue covers both retrieving animal details from RVO and ingesting them into fdm — combining what was originally scoped as two separate issues (`fdm-rvo` client vs. `fdm-core` ingestion) because the parsed-response shape, the eartag/date parsers, and the field-by-field mapping are one continuous concern best reviewed together; splitting them risked the client and ingestion code drifting out of sync on exactly what fields/formats are exchanged. The relevant RVO message is "Raadplegen Dier- en merkdetails" (`Berichtenboek I&R 3.0.7.pdf`, RVO versie 3.0.7, pages 103-111) — a request/reply lookup returning animal and mark/chip details for one animal identified by life number, work number, or health-certificate number. The full field-by-field mapping to the proposed fdm schema already exists in `research\diary\rvo-animal-mapping.md` — read that document before implementing this issue, it is the source of truth for which fields to extract and how to normalize them.

## Scope

### Part 1 — `fdm-rvo`: retrieval client + shared parsers
- Implement a client function/module for the "Raadplegen Dier- en merkdetails" SOAP/XML message in `fdm-rvo/src` (naming/style consistent with the existing `auth.ts`/`data.ts`/`process.ts` modules), covering:
  - Request construction: `selDierLandcode`/`selDierLevensnummer` (or the combined form), `selRelatienummerHouder`, `selMeldingeenheid`, and the `ind*` flags needed for this integration (set to `N` for anything not needed, per the Berichtenboek's own performance guidance).
  - Response parsing into a typed shape covering at least: `dierLandcode`/`dierLevensnummer`, `dierWerknummer`, `dierSoort`, `dierCategorie`, `geboortedatum`, `dierHaarkleur`, `dierGeslacht`, `dierOorspronkelijkeIdentificatie`, `dierHerkomstLandcode`, `dierOorsprongLandcode`, `importdatum`, `aanvoerDatumME`, `afvoerDatumME`, `dierEinddatum`, `dierRedenEinde`, `moederLandcode`/`moederLevensnummer` — every field the mapping doc marks as "direct mapping" or "new column proposed", excluding the fields the mapping doc explicitly lists as out of scope (mark-replacement history, `registratiesEnInstanties`, exportworthiness fields, `dierPremiestatus`).
- One shared **eartag/country-code parser** normalizing RVO's three accepted identifier shapes: split fields (`dierLandcode` + `dierLevensnummer`), a combined string with the country/ISO code prefixed (`NL12345789012`/`52812345789012`), and the plain number with no prefix. Exported as a standalone function so it's reusable by any future arrival/departure/birth message client too.
- One shared **date parser/formatter** for RVO's `DD-MM-YYYY` date-only format, converting to/from the format needed for fdm's `timestamptz` columns.
- Error handling: surface RVO's documented error cases (unknown format, unknown mark, no animals found) as typed errors/results rather than throwing raw SOAP faults, consistent with this package's existing error-handling style.
- Unit tests: request construction for both split and combined identifier forms, response parsing against a representative fixture (build a realistic fixture based on the Berichtenboek's documented fields — no real farm/animal data), the eartag parser's round-trip for all three input shapes, and each documented error case.

### Part 2 — `fdm-core`: ingest RVO animal details into the dairy schema
- Add an ingestion function (e.g. `importAnimalFromRvo(fdm, principal_id, b_id_farm, rvoAnimalDetails)`) that, given Part 1's parsed response and a target farm, performs the following upserts inside a single `fdm.transaction`:
  - **Direct mappings**: `animals.b_id_eartag` (parsed combined identifier), `animals.b_id_worknumber` (`dierWerknummer`), `animals.b_species` (`dierSoort` → `animalSpeciesEnum`, currently `rund` only), `animals.b_birthdate` (`geboortedatum`), `animals.b_coatcolor` (`dierHaarkleur`), `animals.b_sex` (`dierGeslacht`).
  - **Herd category**: `dierCategorie` drives which herd the animal's `animal_assigning` row points to (creating the herd if it doesn't exist for this farm/category yet) — do **not** store the category on the `animals` row itself, per the "category lives on the herd" design decision.
  - **Arrival/departure**: `aanvoerDatumME` → `animal_arriving.b_start` for this farm; `afvoerDatumME` → `animal_leaving.b_end` for this farm; `dierHerkomstLandcode` (present and ≠ `NL`) → `b_arriving_method = 'imported'`, otherwise `'purchased'` (leave `'born'` for the not-yet-implemented birth-message case); `dierEinddatum`/`dierRedenEinde` → `animal_leaving.b_end`/`b_leaving_method`, reconciled against `afvoerDatumME` if both present (log/flag a discrepancy rather than silently picking one).
  - **New columns this issue also adds to the schema** (RVO-specific, deferred from the core-schema issue since it had no concrete source for them yet): `animals.b_id_dam` (self-referencing FK, nullable — resolve via an eartag lookup against already-imported animals; if not found, leave `NULL`, don't create a placeholder animal purely for lineage) and `animal_arriving.b_id_origincountry` (from `dierOorsprongLandcode`).
  - **Explicitly not handled**: `dierKalfdatum` (deferred to the Layer-3 `animal_calving` action), `vlagsoort`/`maatregelCode` (deferred to the Layer-3 `animal_flagging` action), `dierPremiestatus` (not mapped at all).
  - Idempotency: re-importing the same animal (matched by `b_id_eartag`) updates the existing row rather than creating a duplicate.
  - Authorization: reuse the `animal`/`herd` resources from the core-schema issue; the importing principal must have write access to the target farm.

## Acceptance criteria

- [ ] Client function builds a valid request for at least the split-field and combined-string identifier forms.
- [ ] Response parser correctly extracts every field listed in `rvo-animal-mapping.md`'s "Direct mappings" and "Fields with no current fdm equivalent" tables (excluding fields explicitly out of scope for this message).
- [ ] Shared eartag/country-code parser round-trips correctly for split fields, combined-with-alpha-code, and combined-with-ISO-numeric-code inputs; shared date parser correctly converts `DD-MM-YYYY` to/from fdm's `timestamptz` format.
- [ ] Documented RVO error cases (bad number format, unknown mark, no animal found) surface as typed errors, not unhandled exceptions.
- [ ] Given a fixture RVO response, `importAnimalFromRvo` creates a new `animals` row with all direct-mapping columns populated correctly, and assigns the animal to the correct herd for its `dierCategorie` (creating the herd if needed).
- [ ] Re-running the import for the same animal (same eartag) updates the existing row instead of creating a duplicate.
- [ ] `animal_arriving`/`animal_leaving` rows are created/updated correctly from `aanvoerDatumME`/`afvoerDatumME`/`dierEinddatum`/`dierRedenEinde`, with correct arrival-method inference for at least one case of each.
- [ ] `b_id_dam` resolves correctly when the dam is already fdm-tracked, and stays `NULL` (no placeholder row) when she isn't.
- [ ] A permission-denied case (principal without write access to the target farm) is covered by a test.
- [ ] `*.test.ts` pass for both `fdm-rvo` and `fdm-core`; `pnpm build` succeeds for both packages.

## Out of scope

Any UI for triggering or reviewing an RVO import (flag to the team whether a review/confirm UI is needed before auto-writing RVO data, since silently overwriting a farmer's manually-entered `b_breed`/`b_coatcolor` could be surprising — not decided here), arrival/departure/birth RVO messages beyond the shared parsers anticipating their eventual reuse, the Layer-3 `animal_calving`/`animal_flagging` actions themselves (only their future data source is being anticipated here).

## References

`Berichtenboek I&R 3.0.7.pdf` chapter 6, "Raadplegen Dier- en merkdetails" (pp. 103-111); `research\diary\rvo-animal-mapping.md` (full field mapping and rationale); `dairy-farming-implementation-plan-FINAL.md` §4.1 ("Count → animals" enrichment note).
