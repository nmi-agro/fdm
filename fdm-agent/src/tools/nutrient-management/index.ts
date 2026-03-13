import { FunctionTool, type Context } from '@google/adk';
import { z } from 'zod';
import { 
    getNutrientAdvice, 
    createFunctionsForNorms, 
    createFunctionsForFertilizerApplicationFilling,
    calculateOrganicMatterBalanceField,
    collectInputForOrganicMatterBalance,
    calculateNitrogenBalanceField,
    collectInputForNitrogenBalance
} from '@nmi-agro/fdm-calculator';
import { getFertilizers, getCultivations, getCurrentSoilData, getField } from '@nmi-agro/fdm-core';
import type { FdmType, PrincipalId, Fertilizer } from '@nmi-agro/fdm-core';

interface AdviceArgs {
    fieldIds: string[];
    nmiApiKey: string;
}

/**
 * Creates tools for nutrient management.
 * @param fdm The non-serializable FDM database instance.
 */
export function createNutrientManagementTools(fdm: FdmType) {
    /**
     * Tool for fetching nutrient advice (N, P, K and others).
     */
    const getFarmNutrientAdviceTool = new FunctionTool({
        name: 'getFarmNutrientAdvice',
        description: 'Get the full nutrient advice (N, P, K, Ca, Mg, S, micro-nutrients) for specific fields based on soil samples and crop rotation.',
        parameters: z.object({
            fieldIds: z.array(z.string()).describe('List of field IDs to fetch advice for'),
            nmiApiKey: z.string().describe('API key for NMI services'),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error('Context is required');
            const principalId = context.state.get('principalId') as PrincipalId;
            const args = input as AdviceArgs;
            
            const results = await Promise.all(args.fieldIds.map(async (fieldId) => {
                const field = await getField(fdm, principalId, fieldId);
                const cultivations = await getCultivations(fdm, principalId, fieldId);
                const currentSoilData = await getCurrentSoilData(fdm, principalId, fieldId);

                const advice = await getNutrientAdvice({
                    b_lu_catalogue: cultivations[0]?.b_lu_catalogue || "",
                    b_centroid: field.b_centroid ? [field.b_centroid.x, field.b_centroid.y] : undefined,
                    currentSoilData: currentSoilData,
                    nmiApiKey: args.nmiApiKey,
                    b_bufferstrip: field.b_bufferstrip,
                });
                return {
                    fieldId: fieldId,
                    advice: advice.data.year,
                };
            }));
            return results;
        }
    });

    /**
     * Tool for fetching legal norms (Animal Manure N, Workable N, Phosphate).
     */
    const getFarmLegalNormsTool = new FunctionTool({
        name: 'getFarmLegalNorms',
        description: 'Get the three legal limits (Animal Manure Nitrogen, Total Workable Nitrogen, and Phosphate) for fields.',
        parameters: z.object({
            farmId: z.string().describe('The ID of the farm'),
            fieldIds: z.array(z.string()).describe('List of field IDs to check'),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error('Context is required');
            const principalId = context.state.get('principalId') as PrincipalId;
            const calendar = "2025"; 

            const normFunctions = createFunctionsForNorms("NL", calendar as any);
            const results = await Promise.all(input.fieldIds.map(async (fieldId: string) => {
                const normsInput = await normFunctions.collectInputForNorms(fdm, principalId, fieldId);
                const [manure, phosphate, nitrogen] = await Promise.all([
                    normFunctions.calculateNormForManure(fdm, normsInput),
                    normFunctions.calculateNormForPhosphate(fdm, normsInput),
                    normFunctions.calculateNormForNitrogen(fdm, normsInput),
                ]);
                return {
                    fieldId: fieldId,
                    norms: {
                        animalManureN: manure.normValue,
                        workableN: nitrogen.normValue,
                        phosphate: phosphate.normValue,
                    }
                };
            }));
            return results;
        }
    });

    /**
     * Tool for searching fertilizers in the farm inventory.
     */
    const searchFertilizersTool = new FunctionTool({
        name: 'searchFertilizers',
        description: 'Search for fertilizer products available in the farm inventory (including custom ones) by name or type.',
        parameters: z.object({
            farmId: z.string().describe('The ID of the farm to search inventory for'),
            query: z.string().optional().describe('Search term (e.g. "pig manure", "KAS")'),
            type: z.enum(['manure', 'mineral', 'compost']).optional().describe('Filter by type'),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error('Context is required');
            const args = input as SearchArgs;
            const principalId = context.state.get('principalId') as PrincipalId;

            if (!fdm || !principalId || !args.farmId) {
                return [];
            }

            const farmFertilizers = await getFertilizers(fdm, principalId, args.farmId);
            let results = [...farmFertilizers];
            
            if (args.type) {
                results = results.filter(f => f.p_type === args.type);
            }
            
            if (args.query) {
                const q = args.query.toLowerCase();
                results = results.filter(f => 
                    f.p_name_nl?.toLowerCase().includes(q) || 
                    f.p_id_catalogue?.toLowerCase().includes(q)
                );
            }
            
            return results.slice(0, 50).map(f => ({
                p_id: f.p_id,
                p_id_catalogue: f.p_id_catalogue,
                p_name_nl: f.p_name_nl,
                p_type: f.p_type,
                p_app_method_options: f.p_app_method_options || [],
                nutrients: {
                    N: f.p_n_rt,
                    P2O5: f.p_p_rt,
                    K2O: f.p_k_rt,
                    MgO: f.p_mg_rt,
                    CaO: f.p_ca_rt,
                    SO3: f.p_s_rt,
                    Cu: f.p_cu_rt,
                    Zn: f.p_zn_rt,
                    B: f.p_b_rt,
                    workabilityN: f.p_n_wc,
                    organicMatter: f.p_om,
                    effectiveOrganicMatter: f.p_eom,
                    p_ef_nh3: f.p_ef_nh3
                },
                isCustom: f.p_source === args.farmId
            }));
        }
    });

    /**
     * Tool for simulating farm plans and checking compliance across all 3 norms and organic matter balance.
     */
    const simulateFarmPlanTool = new FunctionTool({
        name: 'simulateFarmPlan',
        description: 'Simulates a proposed fertilizer plan to check compliance against all 3 legal norms, organic matter balance, and nitrogen balance.',
        parameters: z.object({
            farmId: z.string().describe('The ID of the farm'),
            fields: z.array(z.object({
                fieldId: z.string(),
                applications: z.array(z.object({
                    p_id_catalogue: z.string(),
                    p_app_amount: z.number(),
                    p_app_date: z.string(),
                    p_app_method: z.string().optional(),
                })),
            })).describe('Proposed applications per field'),
        }) as any,
        execute: async (input: any, context?: Context) => {
            if (!context) throw new Error('Context is required');
            const args = input as SimulationArgs;
            const principalId = context.state.get('principalId') as PrincipalId;
            const fillingFunctions = createFunctionsForFertilizerApplicationFilling();
            const calendar = "2025"; 

            if (!fdm || !principalId || !args.farmId) {
                throw new Error('Database connection or Farm ID missing');
            }

            const timeframe = {
                b_date: new Date(`${calendar}-01-01`),
                e_date: new Date(`${calendar}-12-31`)
            } as any;

            const [omInput, nInput, fertilizers] = await Promise.all([
                collectInputForOrganicMatterBalance(fdm, principalId, args.farmId, timeframe),
                collectInputForNitrogenBalance(fdm, principalId, args.farmId, timeframe),
                getFertilizers(fdm, principalId, args.farmId)
            ]);

            const fieldResults = await Promise.all(args.fields.map(async (fieldData) => {
                const fieldInfo = await getField(fdm, principalId, fieldData.fieldId);
                
                if (fieldInfo.b_bufferstrip && fieldData.applications.length > 0) {
                    return {
                        fieldId: fieldData.fieldId,
                        error: 'Field is a buffer strip and cannot receive fertilizer applications.',
                        isValid: false,
                        filling: { animalManureN: 0, workableN: 0, phosphate: 0 },
                        norms: { animalManureN: 0, workableN: 0, phosphate: 0 }
                    };
                }

                const appsWithDetails = fieldData.applications.map((app) => {
                    const details = fertilizers.find((f: Fertilizer) => f.p_id_catalogue === app.p_id_catalogue);
                    if (!details) {
                        throw new Error(`Fertilizer ${app.p_id_catalogue} not found in farm inventory.`);
                    }
                    return { 
                        ...app, 
                        ...details,
                        p_app_date: new Date(app.p_app_date)
                    };
                });
                
                const normFuncs = createFunctionsForNorms("NL", calendar as any);
                const normsInput = await normFuncs.collectInputForNorms(fdm, principalId, fieldData.fieldId);
                const filling = fillingFunctions.getFillings(appsWithDetails as any, normsInput);
                const norms = await normFuncs.calculateNorms(fdm, normsInput);
                
                const fieldOmInput = omInput.fields.find((f: any) => f.field.b_id === fieldData.fieldId);
                let omBalance = null;
                if (fieldOmInput) {
                    try {
                        omBalance = calculateOrganicMatterBalanceField({
                            fieldInput: {
                                ...fieldOmInput,
                                fertilizerApplications: appsWithDetails as any
                            },
                            fertilizerDetails: omInput.fertilizerDetails,
                            cultivationDetails: omInput.cultivationDetails,
                            timeFrame: {
                                start: timeframe.b_date,
                                end: timeframe.e_date
                            }
                        });
                    } catch (e) {}
                }

                const fieldNInput = nInput.fields.find((f: any) => f.field.b_id === fieldData.fieldId);
                let nBalance = null;
                if (fieldNInput) {
                    try {
                        nBalance = calculateNitrogenBalanceField({
                            fieldInput: {
                                ...fieldNInput,
                                fertilizerApplications: appsWithDetails as any
                            },
                            fertilizerDetails: nInput.fertilizerDetails,
                            cultivationDetails: nInput.cultivationDetails,
                            harvestDetails: nInput.harvestDetails,
                            timeFrame: {
                                start: timeframe.b_date,
                                end: timeframe.e_date
                            }
                        });
                    } catch (e) {}
                }
                
                return {
                    fieldId: fieldData.fieldId,
                    b_area: fieldInfo.b_area,
                    filling: {
                        animalManureN: filling.manure.normFilling,
                        workableN: filling.nitrogen.normFilling,
                        phosphate: filling.phosphate.normFilling,
                    },
                    norms: {
                        animalManureN: norms.manure.normValue,
                        workableN: norms.nitrogen.normValue,
                        phosphate: norms.phosphate.normValue,
                    },
                    omBalance: omBalance?.balance,
                    nBalance: nBalance ? {
                        balance: nBalance.balance,
                        target: nBalance.target,
                        isBelowTarget: nBalance.balance <= nBalance.target
                    } : null,
                    isValid: true
                };
            }));
            
            const farmTotals = fieldResults.reduce((acc: any, curr: any) => {
                if (!curr.isValid) return acc;
                const area = curr.b_area;
                acc.manureFilling += curr.filling.animalManureN * area;
                acc.workableNFilling += curr.filling.workableN * area;
                acc.phosphateFilling += curr.filling.phosphate * area;
                acc.manureNorm += curr.norms.animalManureN * area;
                acc.workableNNorm += curr.norms.workableN * area;
                acc.phosphateNorm += curr.norms.phosphate * area;
                
                if (curr.nBalance) {
                    acc.nBalanceTotal += curr.nBalance.balance * area;
                    acc.nTargetTotal += curr.nBalance.target * area;
                }
                return acc;
            }, { 
                manureFilling: 0, workableNFilling: 0, phosphateFilling: 0, 
                manureNorm: 0, workableNNorm: 0, phosphateNorm: 0,
                nBalanceTotal: 0, nTargetTotal: 0
            });

            const hasBufferStripViolations = fieldResults.some(r => !r.isValid && r.error);

            return {
                fieldResults,
                farmTotals: {
                    ...farmTotals,
                    nBalanceValid: farmTotals.nBalanceTotal <= farmTotals.nTargetTotal
                },
                isValid: !hasBufferStripViolations &&
                         farmTotals.manureFilling <= farmTotals.manureNorm &&
                         farmTotals.workableNFilling <= farmTotals.workableNNorm &&
                         farmTotals.phosphateFilling <= farmTotals.phosphateNorm
            };
        }
    });

    return [
        getFarmNutrientAdviceTool,
        getFarmLegalNormsTool,
        searchFertilizersTool,
        simulateFarmPlanTool
    ];
}

interface SearchArgs {
    farmId: string;
    query?: string;
    type?: 'manure' | 'mineral' | 'compost';
}

interface SimulationField {
    fieldId: string;
    applications: {
        p_id_catalogue: string;
        p_app_amount: number;
        p_app_date: string;
        p_app_method?: string;
    }[];
}

interface SimulationArgs {
    farmId: string;
    fields: SimulationField[];
}
