import {useCallback,useEffect,useMemo,useState} from 'react';
import type {InventorySummary,ProjectInventoryConfig,PropertyUnit} from '../../domain/inventory';
import {inventoryErrorMessage,summarizeInventory} from '../../domain/inventory';
import {useInventoryReader} from './InventoryContext';

export interface InventoryLoadState {data:PropertyUnit[];summary:InventorySummary;loading:boolean;error:string;retry:()=>void;}
const emptySummary=summarizeInventory([]);
export function useProjectInventory(config:ProjectInventoryConfig):InventoryLoadState{
  const reader=useInventoryReader(),[data,setData]=useState<PropertyUnit[]>([]),[summary,setSummary]=useState(emptySummary),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);const retry=useCallback(()=>setAttempt(value=>value+1),[]);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');reader.listPublishedUnits({organizationSlug:config.organizationSlug,projectSlug:config.projectSlug,signal:controller.signal}).then(units=>{if(!controller.signal.aborted){setData(units);setSummary(summarizeInventory(units));setLoading(false);}}).catch(reason=>{if(!controller.signal.aborted){setData([]);setSummary(emptySummary);setError(inventoryErrorMessage(reason));setLoading(false);}});return()=>controller.abort();},[reader,config.organizationSlug,config.projectSlug,attempt]);
  return {data,summary,loading,error,retry};
}
export function useSelectedUnit(units:readonly PropertyUnit[],config:ProjectInventoryConfig,requestedCode:string|null){return useMemo(()=>{if(!units.length)return {unit:null,invalidCode:false};const requested=requestedCode&&units.find(u=>u.code===requestedCode);const fallback=units.find(u=>u.code===config.defaultUnitCode)??units[0];return {unit:requested??fallback,invalidCode:Boolean(requestedCode&&!requested)};},[units,config.defaultUnitCode,requestedCode]);}
