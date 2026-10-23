import {readFile} from 'node:fs/promises';
const state=JSON.parse(await readFile(new URL('./readiness.json',import.meta.url)));
const blocked=Object.entries(state.gates).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({remoteDeploymentAuthorized:state.remoteDeploymentAuthorized,realBuyerDataAuthorized:state.realBuyerDataAuthorized,blocked}));
if(blocked.length||!state.remoteDeploymentAuthorized)process.exitCode=1;
