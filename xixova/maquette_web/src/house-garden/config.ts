export type ResourceStatus = 'verified' | 'illustrative' | 'pending';
export type Resource = { label: string; status: ResourceStatus; url?: string; thumbnail?: string; note?: string };

const site = 'https://housegardencantodoforte.com.br';
const uploads = `${site}/wp-content/uploads/2025/06`;

export const houseGarden = {
  name: 'House Garden',
  subtitle: 'Canto do Forte · Praia Grande',
  demoUrl: '/demo',
  rowLabels: {
    buyer: { apartments: 'Apartamentos disponíveis', plans: 'Plantas e tour virtual', project: 'Conheça o empreendimento', location: 'Localização', contact: 'Falar no WhatsApp' },
    broker: { availability: 'Tabela e disponibilidade', conditions: 'Condições de venda', materials: 'Material de divulgação', book: 'Book digital', contact: 'Falar com o comercial' },
  },
  copy: {
    apartmentsIntro: 'Em breve, você poderá explorar as unidades de exemplo por aqui.',
    otherBuilding: 'Quer conhecer a experiência 3D da Promoven? O visor abaixo representa outro edifício ilustrativo.',
    tourNote: 'Tour externo de House Garden. Abre somente quando solicitado.',
    projectIntro: 'Conheça os ambientes e as áreas de lazer em perspectivas ilustrativas do projeto.',
    mapNote: 'O mapa externo abre somente quando solicitado.',
    pendingContact: 'Contato não configurado',
    pendingConditions: 'Condições comerciais pendentes',
    conditionsNote: 'A tabela de vendas vigente precisa ser autorizada antes da publicação.',
    availabilityNote: 'Não representa a disponibilidade real do House Garden.',
    bookIntro: 'Material público do House Garden disponibilizado pela Atlantika Incorporadora.',
  },
  siteUrl: site,
  tour: { label: 'Tour virtual House Garden', status: 'verified', url: 'https://www.alcstudio.com.br/clientes/atlk-house-garden/' } as Resource,
  book: { label: 'Book digital House Garden', status: 'verified', url: 'https://construtoraatlantika.com.br/wp-content/uploads/2025/06/lzba_house_garden_whats_rolagem_v02_r01.pdf' } as Resource,
  plans: [
    { label: 'Planta · 73,36 m²', status: 'verified', url: `${uploads}/planta_7336-1.png`, thumbnail: `${uploads}/planta_7336-1-282x300.png`, note: '2 dormitórios · 1 suíte' },
    { label: 'Planta · 72,01 m²', status: 'pending', note: 'A imagem publicada para esta tipologia repete a planta de 73,36 m².' },
  ] as Resource[],
  gallery: [
    { label: 'Living 72 m²', status: 'illustrative', url: `${uploads}/living_apto_72m2.jpg`, thumbnail: `${uploads}/living_apto_72m2-1024x899.jpg` },
    { label: 'Living 73 m²', status: 'illustrative', url: `${uploads}/living_apto_73m2.jpg`, thumbnail: `${uploads}/living_apto_73m2-1024x602.jpg` },
    { label: 'Piscina', status: 'illustrative', url: `${uploads}/piscina_02.jpg`, thumbnail: `${uploads}/piscina_02-1024x853.jpg` },
  ] as Resource[],
  address: 'Avenida Marechal Hermes, 900 · Canto do Forte · Praia Grande, SP',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Avenida%20Marechal%20Hermes%2C%20900%2C%20Canto%20do%20Forte%2C%20Praia%20Grande%2C%20SP',
  contacts: {
    buyer: { number: undefined as string | undefined, message: 'Olá! Gostaria de saber mais sobre o House Garden.' },
    broker: { number: undefined as string | undefined, message: 'Olá! Sou corretor e gostaria de informações sobre o House Garden.' },
  },
  conditions: { label: 'Condições de venda', status: 'pending' } as Resource,
  availability: [
    { unit: 'Exemplo A', type: '2 dorms', status: 'Disponível' },
    { unit: 'Exemplo B', type: '2 dorms', status: 'Reservado' },
  ],
} as const;
