# GitHub Issue: Implement Carbon Sequestration Card using NMI API data

**Title:** Implement Carbon Sequestration Card using NMI API data

**Description:**
Add a new "Carbon Sequestration" card to the Field Atlas view to provide users with insights into their soil's carbon storage potential. This feature should leverage newly available fields from the NMI API estimates endpoint to show current status versus the physical upper limit of carbon storage.

**Context:**
The NMI API (`/estimates`) provides current soil parameters and has been expanded with several fields related to carbon sequestration:
- `a_som_loi`: Current soil organic matter content (Loss on Ignition).
- `b_c_st03`: Current carbon stock (0-30cm).
- `b_som_potential`: Potential soil organic matter percentage (physical upper limit).
- `b_c_st03_potential`: Potential carbon stock (0-30cm).
- `b_c_delta`: Potential additional carbon sequestration (difference between potential and current stock).

**Proposed Tasks:**

1.  **Update NMI Integration:**
    - Modify `soilParameterEstimatesSchema` in `fdm-app/app/integrations/nmi.ts` to include the new Zod fields: `b_c_st03`, `b_som_potential`, `b_c_st03_potential`, and `b_c_delta`. (`a_som_loi` is already present).
    - Update the TypeScript return type of `getSoilParameterEstimates` to ensure type safety for these new parameters.

2.  **Scaffold UI Component:**
    - Create a new `CarbonSequestrationCard` component in `fdm-app/app/components/blocks/atlas-fields/`.
    - The card should include a visual gauge (e.g., a progress bar) showing current organic matter (`a_som_loi`) vs. the physical upper limit (`b_som_potential`).
    - Include a "Relatable Impact" section that translates potential carbon sequestration into real-world equivalents.
    - Add a technical stats grid for `b_c_st03` and `b_c_st03_potential`.
    - Provide a methodology section (collapsible) explaining the data source and the meaning of the "physical upper limit."

3.  **Expose Data in Route Loader:**
    - In `fdm-app/app/routes/farm.$b_id_farm.$calendar.atlas.fields.$centroid.tsx`, update the `loadAsyncData` function to extract both the existing `a_som_loi` and the new carbon fields from the NMI API response.
    - Pass this data through the loader to the `FieldDetailsAtlas` component.

4.  **Integrate Component:**
    - Add the `CarbonSequestrationCard` to the `FieldDetailsAtlasLayout` in the field details route.
    - Connect the component to the real data provided by the loader.
    - Ensure a proper loading state (skeleton) is implemented in `fdm-app/app/components/blocks/atlas-fields/skeleton.tsx`.

**Relatable Impact Calculation Research:**
Research and implement pedotransfer functions to translate `b_c_delta` (or the corresponding increase in Organic Matter) into metrics that resonate with farmers and advisors:
- **Environmental:** CO2eq equivalents (e.g., car kilometers driven).
- **Agronomic (Farmer/Advisor focus):**
    - **Drought Resilience:** Extra `mm` of water storage capacity (Available Water Capacity).
    - **Nutrient Supply:** Estimated extra `kg N` mineralized per year.
- **Financial/Policy:**
    - **Carbon Credits:** Estimated value in EUR/ha based on current carbon market prices.
    - **Policy Alignment:** Contribution to soil health targets (e.g., EU Soil Strategy).

**Note:** Pedotransfer functions for water storage and N-mineralization need to be identified and integrated into `fdm-calculator` or the app logic.
