import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  Building,
  ManagedProject,
  ProjectInput,
  UnitType,
} from "../domain/structure";
import { SupabaseStructureAdminRepository } from "../infrastructure/structure/SupabaseStructureAdminRepository";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import { usePortal } from "./PortalApp";
const labels = {
  draft: "Rascunho",
  ready: "Pronto",
  published: "Publicado",
  archived: "Arquivado",
} as const;
const empty: ProjectInput = {
  name: "",
  slug: "",
  description: "",
  country: "BR",
  state: "",
  city: "",
  address: "",
  timezone: "America/Sao_Paulo",
  currency: "BRL",
  northOffsetDegrees: 0,
};
const manager = (role?: string) =>
  role === "platform_admin" || role === "organization_admin";
function useRepo() {
  return useMemo(
    () => new SupabaseStructureAdminRepository(getSupabaseClient()),
    [],
  );
}
function Frame({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · Portal Escobar`;
  }, [title]);
  return (
    <div className="portal-page">
      <header className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
const Notice = ({ text }: { text: string }) => (
  <p className="portal-live" role="status">
    {text}
  </p>
);

export function ProjectsPage() {
  const { organization } = usePortal(),
    repo = useRepo(),
    [items, setItems] = useState<ManagedProject[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (organization)
      repo
        .listProjects(organization.id)
        .then(setItems)
        .catch((e) => setMessage(e.message));
  }, [organization?.id]);
  return (
    <Frame
      title="Projetos"
      subtitle="Administre a estrutura dos empreendimentos."
      action={
        manager(organization?.role) ? (
          <Link
            className="primary-button link-button"
            to="/portal/projects/new"
          >
            Novo projeto
          </Link>
        ) : undefined
      }
    >
      <Notice text={message} />
      <section className="portal-panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Estado</th>
              <th>Edifícios</th>
              <th>Pavimentos</th>
              <th>Tipologias</th>
              <th>Unidades</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <br />
                  <small>{p.slug}</small>
                </td>
                <td>
                  <span className="status">{labels[p.status]}</span>
                </td>
                <td>{p.buildingCount}</td>
                <td>{p.floorCount}</td>
                <td>{p.unitTypeCount}</td>
                <td>{p.unitCount}</td>
                <td>
                  <Link to={`/portal/projects/${p.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !message && (
          <div className="empty-state">
            <h2>Nenhum projeto</h2>
            <p>Crie o primeiro projeto desta organização.</p>
          </div>
        )}
      </section>
    </Frame>
  );
}

export function NewProjectPage() {
  const { organization } = usePortal(),
    repo = useRepo(),
    navigate = useNavigate(),
    [message, setMessage] = useState("");
  return (
    <Frame title="Novo projeto" subtitle="O projeto será criado como rascunho.">
      <ProjectForm
        initial={empty}
        onSave={async (input) => {
          try {
            const p = await repo.createProject(organization!.id, input);
            navigate(`/portal/projects/${p.id}`);
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      />
      <Notice text={message} />
    </Frame>
  );
}
function ProjectForm({
  initial,
  onSave,
}: {
  initial: ProjectInput;
  onSave: (i: ProjectInput) => void;
}) {
  const [v, setV] = useState(initial),
    set = (k: keyof ProjectInput, x: unknown) =>
      setV((c) => ({ ...c, [k]: x }));
  return (
    <form
      className="portal-panel structure-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <label>
        Nome
        <input
          required
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <label>
        Slug
        <input
          required
          pattern="[a-z0-9-]+"
          value={v.slug}
          onChange={(e) => set("slug", e.target.value.toLowerCase())}
        />
      </label>
      <label className="form-wide">
        Descrição
        <textarea
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <label>
        País
        <input
          required
          maxLength={2}
          value={v.country}
          onChange={(e) => set("country", e.target.value.toUpperCase())}
        />
      </label>
      <label>
        Estado
        <input value={v.state} onChange={(e) => set("state", e.target.value)} />
      </label>
      <label>
        Cidade
        <input value={v.city} onChange={(e) => set("city", e.target.value)} />
      </label>
      <label>
        Endereço
        <input
          value={v.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </label>
      <label>
        Fuso horário
        <input
          required
          value={v.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        />
      </label>
      <label>
        Latitude
        <input
          type="number"
          step="any"
          value={v.latitude ?? ""}
          onChange={(e) =>
            set(
              "latitude",
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
        />
      </label>
      <label>
        Longitude
        <input
          type="number"
          step="any"
          value={v.longitude ?? ""}
          onChange={(e) =>
            set(
              "longitude",
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
        />
      </label>
      <label>
        Moeda
        <input
          required
          maxLength={3}
          value={v.currency}
          onChange={(e) => set("currency", e.target.value.toUpperCase())}
        />
      </label>
      <label>
        Entrega prevista
        <input
          type="date"
          value={v.estimatedDeliveryDate ?? ""}
          onChange={(e) =>
            set("estimatedDeliveryDate", e.target.value || undefined)
          }
        />
      </label>
      <label>
        Norte (graus)
        <input
          type="number"
          min="-180"
          max="180"
          value={v.northOffsetDegrees}
          onChange={(e) => set("northOffsetDegrees", Number(e.target.value))}
        />
      </label>
      <footer className="form-wide">
        <Link className="secondary-button link-button" to="/portal/projects">
          Cancelar
        </Link>
        <button className="primary-button">Salvar projeto</button>
      </footer>
    </form>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams(),
    { organization } = usePortal(),
    repo = useRepo(),
    [p, setP] = useState<ManagedProject>(),
    [check, setCheck] = useState<any>(),
    [editing, setEditing] = useState(false),
    [message, setMessage] = useState("");
  const load = () =>
    repo
      .listProjects(organization!.id)
      .then((xs) => setP(xs.find((x) => x.id === projectId)));
  useEffect(() => {
    void load();
  }, [projectId, organization?.id]);
  if (!p)
    return (
      <Frame title="Projeto" subtitle="Carregando…">
        <Notice text={message} />
      </Frame>
    );
  const transition = async (status: any) => {
    const reason = window.prompt("Informe o motivo da alteração:");
    if (!reason) return;
    try {
      await repo.changeProjectStatus(
        p.id,
        p.version,
        status,
        reason,
        (p.status === "published" && status === "ready") ||
          status === "archived",
      );
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <Frame
      title={p.name}
      subtitle={`${labels[p.status]} · versão ${p.version}`}
      action={
        <Link
          className="primary-button link-button"
          to={`/portal/projects/${p.id}/structure`}
        >
          Administrar estrutura
        </Link>
      }
    >
      <div className="portal-panel project-actions">
        {manager(organization?.role) && (
          <button onClick={() => setEditing((value) => !value)}>
            Editar dados
          </button>
        )}
        {manager(organization?.role) &&
          (p.status === "ready" || p.status === "published") && (
            <button
              onClick={async () => {
                try {
                  await repo.setCapabilities(
                    p.id,
                    p.version,
                    !p.publicInventoryEnabled,
                    p.visualExperienceEnabled,
                  );
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              {p.publicInventoryEnabled
                ? "Desativar inventário público"
                : "Ativar inventário público"}
            </button>
          )}
        {manager(organization?.role) &&
          (p.status === "ready" || p.status === "published") && (
            <button
              onClick={async () => {
                try {
                  if (!p.visualExperienceEnabled) {
                    const result = await repo.validateVisual(p.id);
                    if (!result.valid) {
                      setMessage(
                        `Não é possível habilitar a experiência 3D: ${result.errors.join(", ")}`,
                      );
                      return;
                    }
                  }
                  await repo.setCapabilities(
                    p.id,
                    p.version,
                    p.publicInventoryEnabled,
                    !p.visualExperienceEnabled,
                  );
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              {p.visualExperienceEnabled
                ? "Desativar experiência 3D"
                : "Validar e ativar experiência 3D"}
            </button>
          )}
        <button
          onClick={() =>
            repo
              .validateProject(p.id)
              .then(setCheck)
              .catch((e) => setMessage(e.message))
          }
        >
          Validar preparação
        </button>
        {manager(organization?.role) && p.status === "draft" && (
          <button onClick={() => transition("ready")}>
            Marcar como pronto
          </button>
        )}
        {manager(organization?.role) && p.status === "ready" && (
          <button onClick={() => transition("published")}>Publicar</button>
        )}
        {manager(organization?.role) && p.status === "published" && (
          <button onClick={() => transition("ready")}>
            Retirar publicação
          </button>
        )}
        {manager(organization?.role) && p.status !== "archived" && (
          <button className="danger" onClick={() => transition("archived")}>
            Arquivar
          </button>
        )}
      </div>
      <Notice text={message} />
      {editing && (
        <ProjectForm
          initial={{
            name: p.name,
            slug: p.slug,
            description: p.description,
            country: p.country,
            state: p.state,
            city: p.city,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
            timezone: p.timezone,
            currency: p.currency,
            estimatedDeliveryDate: p.estimatedDeliveryDate,
            northOffsetDegrees: p.northOffsetDegrees,
          }}
          onSave={async (input) => {
            try {
              await repo.updateProject(p.id, p.version, input);
              setEditing(false);
              await load();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        />
      )}
      {check && (
        <section
          className={`portal-panel readiness ${check.ready ? "ready" : "blocked"}`}
        >
          <h2>{check.ready ? "Projeto pronto" : "Pendências encontradas"}</h2>
          <p>
            {check.buildings} edifícios · {check.floors} pavimentos ·{" "}
            {check.unitTypes} tipologias · {check.units} unidades
          </p>
          {check.errors.map((x: string) => (
            <code key={x}>{x}</code>
          ))}
        </section>
      )}
    </Frame>
  );
}

export function ProjectStructurePage() {
  const { projectId } = useParams(),
    repo = useRepo(),
    [items, setItems] = useState<Building[]>([]),
    [message, setMessage] = useState("");
  const load = () =>
    repo
      .listBuildings(projectId!)
      .then(setItems)
      .catch((e) => setMessage(e.message));
  useEffect(() => {
    void load();
  }, [projectId]);
  const create = async () => {
    const code = window.prompt("Código do edifício:"),
      name = window.prompt("Nome do edifício:");
    if (!code || !name) return;
    try {
      await repo.saveBuilding({
        projectId: projectId!,
        code,
        name,
        displayOrder: items.length + 1,
        active: true,
      });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const edit = async (b: Building) => {
    const code = window.prompt("Código do edifício:", b.code),
      name = window.prompt("Nome do edifício:", b.name);
    if (!code || !name) return;
    try {
      await repo.saveBuilding({
        id: b.id,
        projectId: projectId!,
        expectedVersion: b.version,
        code,
        name,
        displayOrder: b.displayOrder,
        active: b.active,
      });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <Frame
      title="Estrutura"
      subtitle="Edifícios e pavimentos do projeto."
      action={
        <button className="primary-button" onClick={create}>
          Novo edifício
        </button>
      }
    >
      <nav className="breadcrumbs">
        <Link to={`/portal/projects/${projectId}`}>Projeto</Link>
        <span>›</span>
        <strong>Estrutura</strong>
      </nav>
      <Notice text={message} />
      <section className="management-grid">
        {items.map((b) => (
          <article className="portal-panel structure-card" key={b.id}>
            <span className="status">{b.active ? "Ativo" : "Inativo"}</span>
            <h2>{b.name}</h2>
            <p>
              {b.floorCount} pavimentos · {b.unitCount} unidades
            </p>
            <small>
              Visual:{" "}
              {b.modelPath === "__not_configured__"
                ? "não configurado (protegido)"
                : b.modelPath}
            </small>
            <Link to={`/portal/projects/${projectId}/buildings/${b.id}`}>
              Administrar pavimentos
            </Link>
            <button className="text-button" onClick={() => edit(b)}>
              Editar edifício
            </button>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await repo.saveBuilding({
                    id: b.id,
                    projectId: projectId!,
                    expectedVersion: b.version,
                    code: b.code,
                    name: b.name,
                    displayOrder: b.displayOrder,
                    active: !b.active,
                  });
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              {b.active ? "Desativar" : "Ativar"}
            </button>
          </article>
        ))}
      </section>
      <div className="structure-links">
        <Link to={`/portal/projects/${projectId}/unit-types`}>Tipologias</Link>
        <Link to={`/portal/projects/${projectId}/units/new`}>Nova unidade</Link>
      </div>
    </Frame>
  );
}

export function BuildingPage() {
  const { projectId, buildingId } = useParams(),
    repo = useRepo(),
    [floors, setFloors] = useState<any[]>([]),
    [message, setMessage] = useState("");
  const load = () =>
    repo
      .listFloors(buildingId!)
      .then(setFloors)
      .catch((e) => setMessage(e.message));
  useEffect(() => {
    void load();
  }, [buildingId]);
  const generate = async () => {
    const start = Number(window.prompt("Pavimento inicial:", "1")),
      end = Number(window.prompt("Pavimento final:", "10"));
    try {
      const p = await repo.previewFloors(
        buildingId!,
        start,
        end,
        "{n}",
        "Pavimento {n}",
      );
      if (!p.canConfirm) {
        setMessage(`Conflitos: ${p.conflicts.join(", ")}`);
        return;
      }
      if (window.confirm(`Criar ${p.items.length} pavimentos?`)) {
        await repo.confirmFloors(
          buildingId!,
          start,
          end,
          "{n}",
          "Pavimento {n}",
        );
        await load();
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const saveFloor = async (f?: any) => {
    const code = window.prompt("Código do pavimento:", f?.code ?? ""),
      label = window.prompt("Nome do pavimento:", f?.label ?? "");
    if (!code || !label) return;
    const floorNumber = Number(
      window.prompt("Número do pavimento:", String(f?.floorNumber ?? 0)),
    );
    try {
      await repo.saveFloor({
        id: f?.id,
        buildingId: buildingId!,
        expectedVersion: f?.version,
        code,
        label,
        floorNumber,
        displayOrder: f?.displayOrder ?? floorNumber,
        heightMeters: f?.heightMeters,
        active: f?.active ?? true,
      });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <Frame
      title="Pavimentos"
      subtitle="Inclui térreo, pavimentos negativos e nomes comerciais."
      action={
        <div className="project-actions">
          <button onClick={() => saveFloor()}>Novo pavimento</button>
          <button className="primary-button" onClick={generate}>
            Gerar pavimentos
          </button>
        </div>
      }
    >
      <nav className="breadcrumbs">
        <Link to={`/portal/projects/${projectId}/structure`}>Estrutura</Link>
        <span>›</span>
        <strong>Pavimentos</strong>
      </nav>
      <Notice text={message} />
      <section className="portal-panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Número</th>
              <th>Ordem</th>
              <th>Unidades</th>
              <th>Visual protegido</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {floors.map((f) => (
              <tr key={f.id}>
                <td>{f.code}</td>
                <td>{f.label}</td>
                <td>{f.floorNumber}</td>
                <td>{f.displayOrder}</td>
                <td>{f.unitCount}</td>
                <td>{f.modelObjectId ?? "Não mapeado"}</td>
                <td>
                  <button className="text-button" onClick={() => saveFloor(f)}>
                    Editar
                  </button>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await repo.saveFloor({
                          id: f.id,
                          buildingId: buildingId!,
                          expectedVersion: f.version,
                          code: f.code,
                          label: f.label,
                          floorNumber: f.floorNumber,
                          displayOrder: f.displayOrder,
                          heightMeters: f.heightMeters,
                          active: !f.active,
                        });
                        await load();
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    {f.active ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Frame>
  );
}

export function UnitTypesPage() {
  const { projectId } = useParams(),
    repo = useRepo(),
    [items, setItems] = useState<UnitType[]>([]),
    [message, setMessage] = useState("");
  const load = () =>
    repo
      .listUnitTypes(projectId!)
      .then(setItems)
      .catch((e) => setMessage(e.message));
  useEffect(() => {
    void load();
  }, [projectId]);
  const create = async () => {
    const code = window.prompt("Código da tipologia:"),
      name = window.prompt("Nome da tipologia:");
    if (!code || !name) return;
    try {
      await repo.saveUnitType({
        projectId: projectId!,
        code,
        name,
        privateArea: 1,
        bedrooms: 0,
        suites: 0,
        bathrooms: Number(window.prompt("Quantidade de banheiros:", "1")),
        active: true,
      });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const edit = async (t: UnitType) => {
    const name = window.prompt("Nome da tipologia:", t.name),
      area = Number(window.prompt("Área privativa:", String(t.privateArea)));
    if (!name || !area) return;
    const confirmImpact =
      t.unitCount === 0 ||
      window.confirm(
        `Esta alteração afeta ${t.unitCount} unidades. Deseja continuar?`,
      );
    if (!confirmImpact) return;
    try {
      await repo.saveUnitType({
        id: t.id,
        projectId: projectId!,
        expectedVersion: t.version,
        code: t.code,
        name,
        description: t.description,
        privateArea: area,
        totalArea: t.totalArea,
        bedrooms: t.bedrooms,
        suites: t.suites,
        bathrooms: t.bathrooms,
        parkingSpaces: t.parkingSpaces,
        active: t.active,
        confirmImpact,
      });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <Frame
      title="Tipologias"
      subtitle="Valores padrão herdados pelas unidades."
      action={
        <button className="primary-button" onClick={create}>
          Nova tipologia
        </button>
      }
    >
      <Notice text={message} />
      <section className="portal-panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Área</th>
              <th>Dorm.</th>
              <th>Suítes</th>
              <th>Banheiros</th>
              <th>Unidades</th>
              <th>Interior protegido</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.code}</td>
                <td>{t.name}</td>
                <td>{t.privateArea} m²</td>
                <td>{t.bedrooms}</td>
                <td>{t.suites}</td>
                <td>{t.bathrooms ?? "Não informado"}</td>
                <td>{t.unitCount}</td>
                <td>{t.interiorProjectId ?? "—"}</td>
                <td>
                  <button className="text-button" onClick={() => edit(t)}>
                    Editar
                  </button>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await repo.saveUnitType({
                          id: t.id,
                          projectId: projectId!,
                          expectedVersion: t.version,
                          code: t.code,
                          name: t.name,
                          description: t.description,
                          privateArea: t.privateArea,
                          totalArea: t.totalArea,
                          bedrooms: t.bedrooms,
                          suites: t.suites,
                          bathrooms: t.bathrooms,
                          parkingSpaces: t.parkingSpaces,
                          active: !t.active,
                        });
                        await load();
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    {t.active ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Frame>
  );
}

export function NewUnitPage() {
  const { projectId } = useParams(),
    repo = useRepo(),
    navigate = useNavigate(),
    [buildings, setBuildings] = useState<Building[]>([]),
    [floors, setFloors] = useState<any[]>([]),
    [types, setTypes] = useState<UnitType[]>([]),
    [form, setForm] = useState({
      buildingId: "",
      floorId: "",
      unitTypeId: "",
      unitCode: "",
      orientation: "north",
      currency: "BRL",
      parkingSpaces: 0,
      initialPrice: "",
    }),
    [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all([
      repo.listBuildings(projectId!),
      repo.listUnitTypes(projectId!),
    ]).then(([b, t]) => {
      setBuildings(b);
      setTypes(t);
      setForm((v) => ({
        ...v,
        buildingId: b[0]?.id ?? "",
        unitTypeId: t[0]?.id ?? "",
      }));
    });
  }, [projectId]);
  useEffect(() => {
    if (form.buildingId)
      repo.listFloors(form.buildingId).then((x) => {
        setFloors(x);
        setForm((v) => ({ ...v, floorId: x[0]?.id ?? "" }));
      });
  }, [form.buildingId]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await repo.createUnit({
        ...form,
        projectId: projectId!,
        initialPrice: form.initialPrice ? Number(form.initialPrice) : undefined,
      });
      navigate(`/portal/projects/${projectId}/structure`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <Frame
      title="Nova unidade"
      subtitle="Começa disponível e oculta; preço, estado e publicação permanecem nas RPC comerciais."
    >
      <form className="portal-panel structure-form" onSubmit={submit}>
        <label>
          Código
          <input
            required
            value={form.unitCode}
            onChange={(e) => setForm({ ...form, unitCode: e.target.value })}
          />
        </label>
        <label>
          Edifício
          <select
            required
            value={form.buildingId}
            onChange={(e) => setForm({ ...form, buildingId: e.target.value })}
          >
            {buildings.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pavimento
          <select
            required
            value={form.floorId}
            onChange={(e) => setForm({ ...form, floorId: e.target.value })}
          >
            {floors.map((x) => (
              <option value={x.id} key={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipologia
          <select
            required
            value={form.unitTypeId}
            onChange={(e) => setForm({ ...form, unitTypeId: e.target.value })}
          >
            {types.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Orientação
          <select
            value={form.orientation}
            onChange={(e) => setForm({ ...form, orientation: e.target.value })}
          >
            {[
              "north",
              "northeast",
              "east",
              "southeast",
              "south",
              "southwest",
              "west",
              "northwest",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Estacionamentos
          <input
            min="0"
            type="number"
            value={form.parkingSpaces}
            onChange={(e) =>
              setForm({ ...form, parkingSpaces: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Preço inicial
          <input
            min="0"
            type="number"
            value={form.initialPrice}
            onChange={(e) => setForm({ ...form, initialPrice: e.target.value })}
          />
        </label>
        <footer className="form-wide">
          <button className="primary-button">Criar unidade</button>
        </footer>
      </form>
      <Notice text={message} />
    </Frame>
  );
}

export function StructuralUnitPage() {
  const { projectId, unitId } = useParams(),
    { repo: inventoryRepo } = usePortal(),
    repo = useRepo(),
    navigate = useNavigate(),
    [unit, setUnit] = useState<any>(),
    [buildings, setBuildings] = useState<Building[]>([]),
    [floors, setFloors] = useState<any[]>([]),
    [types, setTypes] = useState<UnitType[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all([
      inventoryRepo.getUnit(unitId!),
      repo.listBuildings(projectId!),
      repo.listUnitTypes(projectId!),
    ]).then(([u, b, t]) => {
      setUnit(u);
      setBuildings(b);
      setTypes(t);
    });
  }, [unitId, projectId]);
  useEffect(() => {
    if (unit?.buildingId) repo.listFloors(unit.buildingId).then(setFloors);
  }, [unit?.buildingId]);
  if (!unit)
    return (
      <Frame title="Estrutura da unidade" subtitle="Carregando…">
        <Notice text={message} />
      </Frame>
    );
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await repo.updateUnit({
        id: unit.id,
        expectedVersion: unit.version,
        buildingId: unit.buildingId,
        floorId: unit.floorId,
        unitTypeId: unit.unitTypeId,
        orientation: unit.orientation,
        viewType: unit.viewType,
        sunExposure: unit.sunExposure,
        currency: "BRL",
        parkingSpaces: unit.parkingSpaces,
      });
      navigate(`/portal/inventory/${unit.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <Frame
      title={`Estrutura da unidade ${unit.code}`}
      subtitle="Preço, status, publicação e mappings visuais não podem ser alterados aqui."
    >
      <form className="portal-panel structure-form" onSubmit={save}>
        <label>
          Edifício
          <select
            value={unit.buildingId}
            onChange={(e) =>
              setUnit({ ...unit, buildingId: e.target.value, floorId: "" })
            }
          >
            {buildings.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pavimento
          <select
            value={unit.floorId}
            onChange={(e) => setUnit({ ...unit, floorId: e.target.value })}
          >
            {floors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipologia
          <select
            value={unit.unitTypeId}
            onChange={(e) => setUnit({ ...unit, unitTypeId: e.target.value })}
          >
            {types.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Orientação
          <select
            value={unit.orientation}
            onChange={(e) => setUnit({ ...unit, orientation: e.target.value })}
          >
            {[
              "north",
              "northeast",
              "east",
              "southeast",
              "south",
              "southwest",
              "west",
              "northwest",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Estacionamentos
          <input
            type="number"
            min="0"
            value={unit.parkingSpaces}
            onChange={(e) =>
              setUnit({ ...unit, parkingSpaces: Number(e.target.value) })
            }
          />
        </label>
        <div className="readonly-grid form-wide">
          <div>
            <span>Proxy GLB protegido</span>
            <strong>{unit.modelObjectId}</strong>
          </div>
          <div>
            <span>Projeto interior protegido</span>
            <strong>{unit.interiorProjectId ?? "—"}</strong>
          </div>
        </div>
        <footer className="form-wide">
          <Link
            className="secondary-button link-button"
            to={`/portal/inventory/${unit.id}`}
          >
            Cancelar
          </Link>
          <button className="primary-button">Salvar estrutura</button>
        </footer>
      </form>
      <Notice text={message} />
    </Frame>
  );
}
