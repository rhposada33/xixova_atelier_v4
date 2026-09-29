import {afterEach,describe,expect,it,vi} from 'vitest';
import {remoteLeadAdapter,resetLeadSubmissionKey,LeadSubmissionError} from './remoteLead';

const lead={name:'Ana',company:'Empresa',role:'',whatsapp:'',email:'ana@example.com',cityState:'São Paulo / SP',unitsRange:'Até 30',launchWindow:'Até 3 meses',model3dStatus:'Ainda não',message:'',consent:true};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();resetLeadSubmissionKey()});
describe('envio comercial',()=>{
  it('usa a mesma chave ao repetir uma falha e a renova após aceitação',async()=>{
    vi.stubEnv('VITE_PROMOVEN_LEADS_ENDPOINT','https://example.test/lead');
    vi.stubGlobal('location',{pathname:'/',search:'?utm_source=campanha'});
    const fetch=vi.fn().mockResolvedValueOnce({status:503}).mockResolvedValueOnce({status:202}).mockResolvedValueOnce({status:202});
    vi.stubGlobal('fetch',fetch);
    await expect(remoteLeadAdapter.submit(lead)).rejects.toBeInstanceOf(LeadSubmissionError);
    await remoteLeadAdapter.submit(lead);
    await remoteLeadAdapter.submit(lead);
    expect(fetch.mock.calls[0][1].headers['X-Idempotency-Key']).toBe(fetch.mock.calls[1][1].headers['X-Idempotency-Key']);
    expect(fetch.mock.calls[2][1].headers['X-Idempotency-Key']).not.toBe(fetch.mock.calls[1][1].headers['X-Idempotency-Key']);
    expect(JSON.parse(fetch.mock.calls[0][1].body).utm_source).toBe('campanha');
  });
  it('distingue limitação e error de rede',async()=>{
    vi.stubEnv('VITE_PROMOVEN_LEADS_ENDPOINT','https://example.test/lead');
    vi.stubGlobal('location',{pathname:'/',search:''});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({status:429}));
    await expect(remoteLeadAdapter.submit(lead)).rejects.toMatchObject({reason:'limited'});
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
    await expect(remoteLeadAdapter.submit(lead)).rejects.toMatchObject({reason:'temporary'});
  });
});
