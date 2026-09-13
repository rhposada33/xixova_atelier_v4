import {createContext,useContext,useMemo,type ReactNode} from 'react';
import type {InventoryReader} from '../../domain/inventory';
import {createInventoryReader} from './createInventoryReader';

const InventoryContext=createContext<InventoryReader|null>(null);
export function InventoryProvider({children,reader}:{children:ReactNode;reader?:InventoryReader}){const value=useMemo(()=>reader??createInventoryReader(),[reader]);return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;}
export function useInventoryReader(){const value=useContext(InventoryContext);if(!value)throw new Error('InventoryProvider não configurado.');return value;}
