import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  issuesCsv,
  parseInventoryCsv,
  templateCsv,
  type ImportDryRun,
  type ImportResult,
  type ImportValidationError,
  type InventoryImportMode,
  type NormalizedImportRow,
} from "../domain/imports";
import { SupabaseInventoryImportRepository } from "../infrastructure/imports/SupabaseInventoryImportRepository";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import { usePortal } from "./PortalApp";

const modeLabels: Record<InventoryImportMode, string> = {
  create_only: "Somente criar",
  update_existing: "Somente atualizar",
  create_and_update: "Criar e atualizar",
};

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Counts({ value }: { value: ImportDryRun | ImportResult }) {
  return (
    <div className="import-counts" aria-label="Resumo da importação">
      <span><strong>{value.newCount}</strong> novas</span>
      <span><strong>{value.updateCount}</strong> atualizações</span>
      <span><strong>{value.unchangedCount}</strong> sem alteração</span>
      <span><strong>{value.warningCount}</strong> avisos</span>
      <span><strong>{value.errorCount}</strong> erros</span>
    </div>
  );
}

export function ImportsPage() {
  const { projectId } = useParams();
  const { projects } = usePortal();
  const project = projects.find((item) => item.id === projectId);
  const repo = useMemo(() => new SupabaseInventoryImportRepository(getSupabaseClient()), []);
  const [mode, setMode] = useState<InventoryImportMode>("create_and_update");
  const [issueFilter, setIssueFilter] = useState("all");
  const [rows, setRows] = useState<NormalizedImportRow[]>([]);
  const [bytes, setBytes] = useState(0);
  const [localIssues, setLocalIssues] = useState<ImportValidationError[]>([]);
  const [dryRun, setDryRun] = useState<ImportDryRun>();
  const [history, setHistory] = useState<ImportResult[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rowPage, setRowPage] = useState(1);
  const [now, setNow] = useState(Date.now());

  const loadHistory = () => project && repo.list(project.id).then(setHistory).catch(() => undefined);
  useEffect(() => { void loadHistory(); }, [project?.id]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(timer)},[]);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setDryRun(undefined);
    setRows([]);
    setLocalIssues([]);
    setMessage("");
    if (!file) return;
    setFileName(file.name);
    const parsed = await parseInventoryCsv(file);
    setRows(parsed.rows);
    setBytes(parsed.bytes);
    setLocalIssues(parsed.errors);
    if (parsed.errors.length) setMessage("Corrija o arquivo antes de validar no servidor.");
  };

  const validate = async () => {
    if (!project || !rows.length || localIssues.length) return;
    setBusy(true);
    setMessage("Validando o arquivo com os dados atuais…");
    try {
      const result = await repo.preview(project.id, mode, rows, bytes, crypto.randomUUID());
      setDryRun(result);
      setMessage(result.errorCount ? "A validação encontrou erros bloqueantes." : "Dry-run concluído. Revise antes de confirmar.");
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível validar a importação.");
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!dryRun || dryRun.errorCount || new Date(dryRun.expiresAt).getTime()<=Date.now()) return;
    setConfirmOpen(false);
    setBusy(true);
    setMessage("Confirmando a importação…");
    try {
      const result = await repo.confirm(dryRun);
      setMessage(`Importação concluída: ${result.rowCount} linhas processadas.`);
      setDryRun(undefined);
      await loadHistory();
    } catch (error) {
      try {
        const verified = await repo.get(dryRun.id);
        if (verified.status === "completed") {
          setMessage(`Importação concluída: ${verified.rowCount} linhas processadas.`);
          setDryRun(undefined);
          await loadHistory();
        } else setMessage(error instanceof Error ? error.message : "Resultado indeterminado. Consulte o histórico antes de tentar novamente.");
      } catch { setMessage("Não foi possível verificar o resultado. Consulte o histórico antes de tentar novamente; nenhum reenvio foi feito."); }
    } finally { setBusy(false); }
  };

  const allIssues = [...localIssues, ...(dryRun?.issues ?? [])];
  const issues=allIssues.filter((item)=>!["new","update","unchanged"].includes(item.code));
  const visibleIssues=issueFilter==="all"?issues:issues.filter((item)=>item.code===issueFilter||item.severity===issueFilter);
  const classification=(row:number)=>allIssues.find((item)=>item.row===row&&["new","update","unchanged"].includes(item.code))?.code??(issues.some((item)=>item.row===row&&item.severity==="error")?"error":"warning");
  const filteredRows=rows.map((row,index)=>({row,index:index+2,result:classification(index+2)})).filter((item)=>issueFilter==="all"||item.result===issueFilter||(issueFilter==="error"&&issues.some((x)=>x.row===item.index&&x.severity==="error"))||(issueFilter==="warning"&&issues.some((x)=>x.row===item.index&&x.severity==="warning")));
  const pageRows=filteredRows.slice((rowPage-1)*25,rowPage*25),rowPages=Math.max(1,Math.ceil(filteredRows.length/25));
  const expired=!!dryRun&&new Date(dryRun.expiresAt).getTime()<=now;
  const statusLabels:Record<string,string>={validated:"Validada",invalid:"Inválida",confirming:"Confirmando",completed:"Concluída",failed:"Falhou",expired:"Expirada"};
  return (
    <div className="portal-page">
      <header className="page-heading"><div><h1>Importar inventário</h1><p>Valide um CSV antes de aplicar alterações ao projeto. Limites: 1.000 linhas e 5 MiB.</p></div><button className="secondary-button" onClick={() => download("modelo-inventario.csv", templateCsv())}>Baixar modelo</button></header>
      <section className="portal-panel import-upload">
        <label>Modo<select value={mode} onChange={(e) => setMode(e.target.value as InventoryImportMode)}>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="file-picker">Arquivo CSV<input accept=".csv,text/csv" type="file" onChange={selectFile} /><span>{fileName ? `${fileName} · ${(bytes/1024).toFixed(1)} KiB` : "Escolher arquivo"}</span></label>
        <button className="primary-button" disabled={busy || !rows.length || !!localIssues.length} onClick={validate}>{busy ? "Processando…" : "Executar dry-run"}</button>
      </section>
      <p className="portal-live" role="status">{message}</p>
      {dryRun && <section className="portal-panel import-preview"><h2>Prévia</h2><Counts value={dryRun} /><p>{expired?<strong>Esta prévia expirou</strong>:<>Válida até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dryRun.expiresAt))}.</>}</p><button className="primary-button" disabled={busy || !!dryRun.errorCount || expired || dryRun.status!=="validated"} onClick={()=>setConfirmOpen(true)}>Confirmar importação</button></section>}
      {dryRun&&<section className="portal-panel table-wrap"><div className="import-table-heading"><h2>Linhas normalizadas</h2><span>Página {rowPage} de {rowPages}</span></div>{pageRows.length?<table><thead><tr><th>Linha</th><th>Unidade</th><th>Edifício</th><th>Andar</th><th>Tipologia</th><th>Resultado</th><th>Alterações</th></tr></thead><tbody>{pageRows.map(({row,index,result})=><tr key={index}><td data-label="Linha">{index}</td><td data-label="Unidade">{row.unit_code}</td><td data-label="Edifício">{row.building_code}</td><td data-label="Andar">{row.floor_code}</td><td data-label="Tipologia">{row.unit_type_code}</td><td data-label="Resultado">{result==="new"?"Nova":result==="update"?"Atualização":result==="unchanged"?"Sem alteração":result==="error"?"Erro":"Aviso"}</td><td data-label="Alterações">{result==="new"?<span>Preço {row.price||"—"}; estado {row.status||"available"}; publicada {row.published||"false"}; orientação {row.orientation}{row.status==="reserved"&&<><br/><strong>Reserva importada sem responsável</strong></>}</span>:result==="update"?<span>Campos estruturais informados no CSV serão comparados e atualizados.</span>:"—"}</td></tr>)}</tbody></table>:<div className="empty-state"><h2>Nenhuma linha nesta categoria</h2></div>}<div className="pagination"><button disabled={rowPage<=1} onClick={()=>setRowPage((p)=>p-1)}>Anterior</button><button disabled={rowPage>=rowPages} onClick={()=>setRowPage((p)=>p+1)}>Próxima</button></div></section>}
      {!!issues.length && <section className="portal-panel table-wrap"><div className="import-table-heading"><h2>Ocorrências</h2><label>Filtrar<select value={issueFilter} onChange={(e)=>setIssueFilter(e.target.value)}><option value="all">Todas</option><option value="new">Novas</option><option value="update">Atualizações</option><option value="unchanged">Sem mudanças</option><option value="warning">Avisos</option><option value="error">Erros</option></select></label><button className="text-button" onClick={() => download("erros-importacao.csv", issuesCsv(issues))}>Baixar relatório</button></div><table><thead><tr><th>Linha</th><th>Coluna</th><th>Tipo</th><th>Mensagem</th></tr></thead><tbody>{visibleIssues.map((issue, index) => <tr key={`${issue.row}-${issue.code}-${index}`}><td data-label="Linha">{issue.row || "—"}</td><td data-label="Coluna">{issue.column || "—"}</td><td data-label="Tipo">{issue.severity === "error" ? "Erro" : "Aviso"}</td><td data-label="Mensagem">{issue.message}</td></tr>)}</tbody></table></section>}
      <section className="portal-panel table-wrap"><div className="import-table-heading"><h2>Histórico</h2></div>{history.length ? <table><thead><tr><th>Data</th><th>Projeto</th><th>Ator</th><th>Modo</th><th>Estado</th><th>Linhas</th><th>Novas</th><th>Atualizadas</th><th>Erros</th><th>Expiração</th><th>Detalhes</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td data-label="Data">{item.createdAt?new Intl.DateTimeFormat("pt-BR").format(new Date(item.createdAt)):"—"}</td><td data-label="Projeto">{project?.name}</td><td data-label="Ator">Usuário autenticado</td><td data-label="Modo">{item.mode?modeLabels[item.mode]:"—"}</td><td data-label="Estado">{statusLabels[item.status]??item.status}</td><td data-label="Linhas">{item.rowCount}</td><td data-label="Novas">{item.newCount}</td><td data-label="Atualizadas">{item.updateCount}</td><td data-label="Erros">{item.errorCount}</td><td data-label="Expiração">{item.expiresAt&&item.status!=="completed"?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(item.expiresAt)):"—"}</td><td data-label="Detalhes"><Link to={`/portal/projects/${projectId}/imports/${item.id}`}>Abrir</Link></td></tr>)}</tbody></table> : <div className="empty-state"><h2>Nenhuma importação</h2><p>Os dry-runs e confirmações aparecerão aqui.</p></div>}</section>
      {confirmOpen&&dryRun&&<div className="drawer-backdrop" role="presentation"><section className="import-confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-import-title"><h2 id="confirm-import-title">Confirmar importação</h2><p><strong>Projeto:</strong> {project?.name}</p><p><strong>Modo:</strong> {modeLabels[dryRun.mode]}</p><Counts value={dryRun}/>{dryRun.updateCount>0&&<p>Esta operação modificará unidades existentes.</p>}<p>A operação é atômica. Se existir um erro bloqueante, nenhuma linha será aplicada.</p><footer><button className="secondary-button" onClick={()=>setConfirmOpen(false)}>Cancelar</button><button className="primary-button" disabled={busy||expired||!!dryRun.errorCount} onClick={confirm}>Confirmar aplicação</button></footer></section></div>}
    </div>
  );
}

export function ImportDetailPage() {
  const { importId, projectId } = useParams();
  const repo = useMemo(() => new SupabaseInventoryImportRepository(getSupabaseClient()), []);
  const [result, setResult] = useState<ImportResult>();
  const [message, setMessage] = useState("Carregando importação…");
  useEffect(() => { if (importId) repo.get(importId).then((value) => { setResult(value); setMessage(""); }).catch((error) => setMessage(error.message)); }, [importId, repo]);
  return <div className="portal-page"><header className="page-heading"><div><h1>Detalhes da importação</h1><p>Resumo persistido. O CSV original e o detalhe completo das filas não são armazenados.</p></div><Link to={`/portal/projects/${projectId}/imports`}>Voltar</Link></header><p className="portal-live" role="status">{message}</p>{result && <><section className="portal-panel import-preview"><span className="status">{result.status}</span><Counts value={result} /><Link to="/portal/inventory">Ver inventário</Link></section>{!!result.issues?.length&&<section className="portal-panel table-wrap"><table><thead><tr><th>Linha</th><th>Coluna</th><th>Código</th><th>Mensagem</th></tr></thead><tbody>{result.issues.map((issue,index)=><tr key={index}><td>{issue.row}</td><td>{issue.column??"—"}</td><td>{issue.code}</td><td>{issue.message}</td></tr>)}</tbody></table></section>}</>}</div>;
}
