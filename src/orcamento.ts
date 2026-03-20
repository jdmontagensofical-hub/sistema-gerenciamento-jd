// orcamento.ts
import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, getDocs, getDoc, Timestamp } from "firebase/firestore";
import { jsPDF } from "jspdf";
import { getNomeAtual, getEmailAtual } from './auth';

// ============================
// Tela Orçamento
// ============================
export function telaOrcamento(dadosEdicao?: any) {
  const isEdicao = !!dadosEdicao;
  const d = dadosEdicao ?? {};

  return `
    <section style="padding:20px;">
      <h1>${isEdicao ? '✏️ Editar Orçamento' : '🧾 Novo Orçamento'} ${isEdicao ? `<span style="font-size:14px; color:#c8a96e;">OR: ${d.numeroOR ?? ''}</span>` : ''}</h1>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px;">
        <div>
          <label>Nome do Cliente:</label><br>
          <input id="cliente" type="text" style="width:100%; margin-top:4px;" value="${d.cliente ?? ''}" />
        </div>
        <div>
          <label>Telefone:</label><br>
          <input id="telefone" type="text" style="width:100%; margin-top:4px;" value="${d.telefone ?? ''}" />
        </div>
        <div style="grid-column:1/-1">
          <label>Endereço:</label><br>
          <input id="endereco" type="text" style="width:100%; margin-top:4px;" value="${d.endereco ?? ''}" />
        </div>
        <div>
          <label>Data do Orçamento:</label><br>
          <input id="dataEntrada" type="date" style="width:100%; margin-top:4px;" value="${d.dataEntradaStr ?? ''}" />
        </div>
        <div>
          <label>Status:</label><br>
          <select id="status" style="width:100%; margin-top:4px; padding:6px;">
            <option value="enviado"   ${(d.status ?? 'enviado') === 'enviado'   ? 'selected' : ''}>Enviado</option>
            <option value="andamento" ${d.status === 'andamento' ? 'selected' : ''}>Andamento</option>
            <option value="concluido" ${d.status === 'concluido' ? 'selected' : ''}>Concluído</option>
            <option value="cancelado" ${d.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>
      </div>

      <label>Descrição do Serviço:</label><br>
      <textarea id="descricaoServico" style="width:100%; margin-top:4px; margin-bottom:10px; min-height:70px;"
        placeholder="Descreva detalhadamente o serviço a ser realizado...">${d.descricaoServico ?? ''}</textarea>

      <h3>Itens do Serviço</h3>
      <div id="itens"></div>
      <button id="addItem" style="margin-bottom:12px;">+ Adicionar Item</button>

      <h3>Total: R$ <span id="total">0</span></h3>

      <label>Observações adicionais (opcional):</label><br>
      <textarea id="observacoes" style="width:100%; margin-top:4px; margin-bottom:14px; min-height:50px;"
        placeholder="Informações extras para o cliente...">${d.observacoes ?? ''}</textarea>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="salvar">${isEdicao ? '💾 Salvar alterações' : '💾 Salvar Orçamento'}</button>
        <button id="gerarPDF">📄 Gerar PDF</button>
        <button id="voltar">Voltar</button>
      </div>

      <input type="hidden" id="orId" value="${d.id ?? ''}" />
      <input type="hidden" id="orNumero" value="${d.numeroOR ?? ''}" />
    </section>
  `;
}

// ============================
// Tipos de móveis
// ============================
const tiposMoveis = ['Móveis planejados', 'Móveis comuns', 'Serviço avulso'];

// ============================
// Adicionar item dinâmico
// ============================
export function adicionarItem(itemExistente?: { descricao: string; valor: number; tipo?: string; quantidade?: number }) {
  const itensContainer = document.getElementById("itens")!;
  const index = itensContainer.children.length;

  const tipo       = itemExistente?.tipo       ?? tiposMoveis[0];
  const qtd        = itemExistente?.quantidade ?? 1;
  const descricao  = itemExistente?.descricao  ?? '';
  const valor      = itemExistente?.valor      ?? '';

  const div = document.createElement("div");
  div.style.cssText = "margin-bottom:10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; background:#1e1e1c; padding:10px; border-radius:8px; border:1px solid #333;";
  div.innerHTML = `
    <select class="tipoItem" style="padding:6px; border-radius:6px; background:#2a2a28; color:#f0ece4; border:1px solid #444; min-width:160px;">
      ${tiposMoveis.map(t => `<option value="${t}" ${t === tipo ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
    <input class="qtdItem" type="number" min="1" value="${qtd}" placeholder="Qtd"
      style="width:60px; padding:6px; border-radius:6px; background:#2a2a28; color:#f0ece4; border:1px solid #444; text-align:center;" />
    <input class="item" placeholder="Descrição do item ${index + 1}" value="${descricao}"
      style="flex:1; min-width:160px; padding:6px; border-radius:6px; background:#2a2a28; color:#f0ece4; border:1px solid #444;" />
    <input class="valor" type="number" placeholder="Valor R$" value="${valor}"
      style="width:110px; padding:6px; border-radius:6px; background:#2a2a28; color:#f0ece4; border:1px solid #444;" />
    <button class="remover" style="padding:4px 10px; background:#5a1f1f; color:#f07060; border:1px solid #7a2f2f; border-radius:6px; cursor:pointer;">✕</button>
  `;
  itensContainer.appendChild(div);

  div.querySelector(".remover")!.addEventListener("click", () => { div.remove(); atualizarTotal(); });
  div.querySelector(".valor")!.addEventListener("input", atualizarTotal);
  div.querySelector(".qtdItem")!.addEventListener("input", atualizarTotal);

  atualizarTotal();
}

// ============================
// Atualizar total
// ============================
function atualizarTotal() {
  const valores = document.querySelectorAll<HTMLInputElement>("#itens .valor");
  const qtds    = document.querySelectorAll<HTMLInputElement>("#itens .qtdItem");
  let total = 0;
  valores.forEach((v, i) => { total += Number(v.value || 0) * Number(qtds[i]?.value || 1); });
  document.getElementById("total")!.textContent = total.toFixed(2);
}

// ============================
// Gerar OR incremental
// ============================
async function gerarNumeroOR(): Promise<string> {
  const snapshot = await getDocs(collection(db, "orcamentos"));
  const count = snapshot.size + 1;
  return count.toString().padStart(10, '0').replace(/(\d{3})(\d{3})(\d{4})/, '$1.$2.$3');
}

// ============================
// Carregar OR para edição
// ============================
export async function carregarParaEdicao(id: string): Promise<any | null> {
  try {
    const docSnap = await getDoc(doc(db, "orcamentos", id));
    if (!docSnap.exists()) return null;
    const data = docSnap.data();

    // Converte Timestamp para string de data
    let dataEntradaStr = '';
    if (data.dataEntrada?.toDate) {
      dataEntradaStr = data.dataEntrada.toDate().toISOString().split('T')[0];
    } else if (data.dataEntrada?.seconds) {
      dataEntradaStr = new Date(data.dataEntrada.seconds * 1000).toISOString().split('T')[0];
    }

    return { id, ...data, dataEntradaStr };
  } catch { return null; }
}

// ============================
// Salvar OR no Firebase (novo ou edição)
// ============================
export async function salvarOrcamento() {
  const id              = (document.getElementById("orId")            as HTMLInputElement).value;
  const numeroORExist   = (document.getElementById("orNumero")        as HTMLInputElement).value;
  const cliente         = (document.getElementById("cliente")         as HTMLInputElement).value;
  const telefone        = (document.getElementById("telefone")        as HTMLInputElement).value;
  const endereco        = (document.getElementById("endereco")        as HTMLInputElement).value;
  const status          = (document.getElementById("status")          as HTMLSelectElement).value;
  const descricaoServico= (document.getElementById("descricaoServico") as HTMLTextAreaElement).value;
  const observacoes     = (document.getElementById("observacoes")     as HTMLTextAreaElement).value;
  const dataEntradaInput= (document.getElementById("dataEntrada")     as HTMLInputElement).value;

  const dataEntrada = dataEntradaInput
    ? Timestamp.fromDate(new Date(dataEntradaInput + 'T12:00:00'))
    : Timestamp.now();

  if (!cliente) { alert("Preencha o nome do cliente!"); return; }

  const tiposInputs   = document.querySelectorAll<HTMLSelectElement>("#itens .tipoItem");
  const qtdsInputs    = document.querySelectorAll<HTMLInputElement>("#itens .qtdItem");
  const itensInputs   = document.querySelectorAll<HTMLInputElement>("#itens .item");
  const valoresInputs = document.querySelectorAll<HTMLInputElement>("#itens .valor");
  const itens: { descricao: string; valor: number; tipo: string; quantidade: number }[] = [];
  let total = 0;

  itensInputs.forEach((input, i) => {
    const valor = Number(valoresInputs[i].value || 0);
    const qtd   = Number(qtdsInputs[i]?.value || 1);
    const tipo  = tiposInputs[i]?.value ?? tiposMoveis[0];
    if (input.value) {
      itens.push({ descricao: input.value, valor, tipo, quantidade: qtd });
      total += valor * qtd;
    }
  });

  const isEdicao = !!id;

  const data: any = {
    cliente, telefone, endereco, status, itens, total,
    descricaoServico, observacoes, dataEntrada,
  };

  if (isEdicao) {
    // Edição — mantém dados originais e registra quem editou
    data.editadoPor    = getEmailAtual();
    data.nomeEditor    = getNomeAtual();
    data.editadoEm     = Timestamp.now();
    await updateDoc(doc(db, "orcamentos", id), data);
    alert(`OR ${numeroORExist} atualizada com sucesso!`);
  } else {
    // Novo — registra criador
    const numeroOR     = await gerarNumeroOR();
    data.numeroOR      = numeroOR;
    data.criadoPor     = getEmailAtual();
    data.nomeResponsavel = getNomeAtual();
    data.criadoEm      = Timestamp.now();
    await addDoc(collection(db, "orcamentos"), data);
    alert(`Orçamento salvo! Número da OR: ${numeroOR}`);
  }
}

// ============================
// Gerar PDF profissional
// ============================
export function gerarPDF() {
  const id              = (document.getElementById("orId")             as HTMLInputElement).value;
  const numeroOR        = (document.getElementById("orNumero")         as HTMLInputElement).value;
  const cliente         = (document.getElementById("cliente")          as HTMLInputElement).value;
  const telefone        = (document.getElementById("telefone")         as HTMLInputElement).value;
  const endereco        = (document.getElementById("endereco")         as HTMLInputElement).value;
  const status          = (document.getElementById("status")           as HTMLSelectElement).value;
  const descricaoServico= (document.getElementById("descricaoServico") as HTMLTextAreaElement).value;
  const observacoes     = (document.getElementById("observacoes")      as HTMLTextAreaElement).value;
  const dataEntradaInput= (document.getElementById("dataEntrada")      as HTMLInputElement).value;
  const dataEntrada     = dataEntradaInput ? new Date(dataEntradaInput + 'T12:00:00') : new Date();

  const tiposInputs   = document.querySelectorAll<HTMLSelectElement>("#itens .tipoItem");
  const qtdsInputs    = document.querySelectorAll<HTMLInputElement>("#itens .qtdItem");
  const itensInputs   = document.querySelectorAll<HTMLInputElement>("#itens .item");
  const valoresInputs = document.querySelectorAll<HTMLInputElement>("#itens .valor");

  const responsavel = getNomeAtual();
  const agora       = new Date().toLocaleDateString('pt-BR');

  const docPDF = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;

  const corEscura   : [number,number,number] = [30,  30,  30];
  const corMedia    : [number,number,number] = [80,  80,  80];
  const corClara    : [number,number,number] = [150, 150, 150];
  const corLinha    : [number,number,number] = [220, 220, 220];
  const corDestaque : [number,number,number] = [40,  40,  40];
  const corFundoTopo: [number,number,number] = [28,  28,  28];
  const corOuro     : [number,number,number] = [180, 140, 80];

  // ── CABEÇALHO ──
  docPDF.setFillColor(...corFundoTopo);
  docPDF.rect(0, 0, W, 52, 'F');
  docPDF.setFillColor(...corOuro);
  docPDF.rect(0, 52, W, 1.2, 'F');

  docPDF.setTextColor(255, 255, 255);
  docPDF.setFontSize(26);
  docPDF.setFont("helvetica", "bold");
  docPDF.text("JD", 18, 22);
  docPDF.setFontSize(11);
  docPDF.setFont("helvetica", "normal");
  docPDF.setTextColor(...corOuro);
  docPDF.text("MONTAGENS & SERVIÇOS", 18, 30);

  docPDF.setFillColor(...corOuro);
  docPDF.rect(80, 10, 0.5, 34, 'F');

  docPDF.setFontSize(9);
  docPDF.setTextColor(200, 200, 200);
  docPDF.setFont("helvetica", "normal");
  docPDF.text("📍  Rua Ceará, 21 — Via Formosa, Taiobeiras - MG", 88, 16);
  docPDF.text("📞  (31) 99311-4716",                               88, 23);
  docPDF.text("📱  WhatsApp: (31) 99311-4716",                     88, 30);
  docPDF.text("📸  @jd_monatagem_de_moveis_ob",                    88, 37);

  // ── TÍTULO ──
  let y = 68;
  docPDF.setTextColor(...corEscura);
  docPDF.setFontSize(16);
  docPDF.setFont("helvetica", "bold");
  docPDF.text("ORÇAMENTO", 18, y);

  if (numeroOR) {
    docPDF.setFontSize(9);
    docPDF.setTextColor(...corOuro);
    docPDF.text(`Nº ${numeroOR}`, 18, y + 7);
  }

  docPDF.setFontSize(9);
  docPDF.setFont("helvetica", "normal");
  docPDF.setTextColor(...corMedia);
  docPDF.text(`Emitido em: ${agora}`, W - 18, y - 4, { align: "right" });
  docPDF.text(`Válido por 15 dias`, W - 18, y + 2, { align: "right" });

  y += 12;
  docPDF.setDrawColor(...corLinha);
  docPDF.setLineWidth(0.3);
  docPDF.line(18, y, W - 18, y);

  // ── DADOS DO CLIENTE ──
  y += 10;
  docPDF.setFillColor(248, 248, 248);
  docPDF.roundedRect(18, y - 5, W - 36, 32, 2, 2, 'F');

  docPDF.setFontSize(8);
  docPDF.setTextColor(...corClara);
  docPDF.setFont("helvetica", "bold");
  docPDF.text("CLIENTE", 24, y + 1);
  docPDF.setFontSize(12);
  docPDF.setTextColor(...corEscura);
  docPDF.setFont("helvetica", "bold");
  docPDF.text(cliente, 24, y + 9);
  docPDF.setFontSize(9);
  docPDF.setFont("helvetica", "normal");
  docPDF.setTextColor(...corMedia);
  docPDF.text(`Telefone: ${telefone}`, 24, y + 16);
  docPDF.text(`Endereço: ${endereco}`, 24, y + 22);

  docPDF.setFontSize(8);
  docPDF.setTextColor(...corClara);
  docPDF.text("DATA DO SERVIÇO", W - 24, y + 1, { align: "right" });
  docPDF.setFontSize(11);
  docPDF.setTextColor(...corEscura);
  docPDF.setFont("helvetica", "bold");
  docPDF.text(dataEntrada.toLocaleDateString('pt-BR'), W - 24, y + 9, { align: "right" });

  // ── DESCRIÇÃO DO SERVIÇO ──
  if (descricaoServico) {
    y += 40;
    const linhasDesc  = docPDF.splitTextToSize(descricaoServico, W - 54);
    const alturaDesc  = 12 + linhasDesc.length * 5.5;
    docPDF.setFillColor(252, 250, 245);
    docPDF.setDrawColor(...corOuro);
    docPDF.setLineWidth(0.5);
    docPDF.roundedRect(18, y - 4, W - 36, alturaDesc, 2, 2, 'FD');
    docPDF.setFontSize(8);
    docPDF.setTextColor(...corOuro);
    docPDF.setFont("helvetica", "bold");
    docPDF.text("DESCRIÇÃO DO SERVIÇO", 24, y + 1);
    docPDF.setFont("helvetica", "normal");
    docPDF.setTextColor(...corMedia);
    docPDF.setFontSize(8.5);
    linhasDesc.forEach((linha: string, idx: number) => {
      docPDF.text(linha, 24, y + 9 + idx * 5.5);
    });
    y += alturaDesc - 4;
  }

  // ── TABELA DE ITENS ──
  y += 38;
  docPDF.setFillColor(...corDestaque);
  docPDF.rect(18, y - 5, W - 36, 10, 'F');
  docPDF.setFontSize(8);
  docPDF.setFont("helvetica", "bold");
  docPDF.setTextColor(255, 255, 255);
  docPDF.text("TIPO",       24,  y + 1);
  docPDF.text("QTD",        86,  y + 1);
  docPDF.text("DESCRIÇÃO",  96,  y + 1);
  docPDF.text("UNIT.",     152,  y + 1);
  docPDF.text("TOTAL", W - 18,  y + 1, { align: "right" });

  y += 10;
  let total = 0;
  let linhaAlternada = false;

  itensInputs.forEach((input, i) => {
    const valor = Number(valoresInputs[i].value || 0);
    const qtd   = Number(qtdsInputs[i]?.value  || 1);
    const tipo  = tiposInputs[i]?.value ?? '';
    if (!input.value) return;

    if (linhaAlternada) {
      docPDF.setFillColor(250, 250, 250);
      docPDF.rect(18, y - 4, W - 36, 9, 'F');
    }
    linhaAlternada = !linhaAlternada;

    docPDF.setFontSize(8);
    docPDF.setFont("helvetica", "normal");
    docPDF.setTextColor(...corEscura);
    docPDF.text(tipo.substring(0, 22),         24,  y + 1);
    docPDF.text(String(qtd),                    88,  y + 1);
    docPDF.text(input.value.substring(0, 30),   96,  y + 1);
    docPDF.setTextColor(...corMedia);
    docPDF.text(`R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 152, y + 1);
    docPDF.setFont("helvetica", "bold");
    docPDF.setTextColor(...corEscura);
    docPDF.text(`R$ ${(valor * qtd).toLocaleString('pt-BR', {minimumFractionDigits:2})}`, W - 18, y + 1, { align: "right" });
    docPDF.setFont("helvetica", "normal");

    y += 9;
    total += valor * qtd;

    if (y > 230) { docPDF.addPage(); y = 20; }
  });

  // ── TOTAL ──
  docPDF.setDrawColor(...corLinha);
  docPDF.line(18, y, W - 18, y);
  y += 6;
  docPDF.setFillColor(...corFundoTopo);
  docPDF.roundedRect(W - 80, y - 5, 62, 14, 2, 2, 'F');
  docPDF.setFontSize(9);
  docPDF.setTextColor(200, 200, 200);
  docPDF.setFont("helvetica", "normal");
  docPDF.text("TOTAL", W - 72, y + 1);
  docPDF.setFontSize(13);
  docPDF.setFont("helvetica", "bold");
  docPDF.setTextColor(...corOuro);
  docPDF.text(`R$ ${total.toFixed(2)}`, W - 24, y + 6, { align: "right" });

  // ── OBSERVAÇÕES ──
  if (observacoes) {
    y += 22;
    docPDF.setDrawColor(...corLinha);
    docPDF.setFillColor(252, 252, 252);
    docPDF.roundedRect(18, y - 4, W - 36, 16, 2, 2, 'FD');
    docPDF.setFontSize(8);
    docPDF.setTextColor(...corClara);
    docPDF.setFont("helvetica", "bold");
    docPDF.text("OBSERVAÇÕES", 24, y + 1);
    docPDF.setFont("helvetica", "normal");
    docPDF.setTextColor(...corMedia);
    docPDF.text(observacoes.substring(0, 130), 24, y + 8);
  }

  // ── TEXTO LEGAL ──
  y += 28;
  if (y > 210) { docPDF.addPage(); y = 20; }

  docPDF.setFillColor(245, 245, 245);
  docPDF.setDrawColor(210, 210, 210);
  docPDF.setLineWidth(0.3);
  docPDF.roundedRect(18, y - 4, W - 36, 72, 2, 2, 'FD');

  docPDF.setFontSize(7.5);
  docPDF.setTextColor(...corMedia);
  docPDF.setFont("helvetica", "bold");
  docPDF.text("TERMOS E CONDIÇÕES", 24, y + 2);
  docPDF.setFont("helvetica", "normal");
  docPDF.setTextColor(100, 100, 100);

  const textoLegal = [
    "As informações sobre as medidas e disposições do mobiliário são de responsabilidade do cliente. Caso haja",
    "divergência do que foi informado pelo cliente com o que existe no físico, o orçamento poderá sofrer alterações.",
    "Durante a montagem será necessário realizar pequenos ajustes nas medidas das peças, e o cliente poderá indicar",
    "o melhor local dentro da residência para realização desses cortes nas peças.",
    "",
    "O cliente deverá apresentar projeto hidráulico e elétrico para que durante as montagens não haja acidente com",
    "essas redes. Em caso de acidente com essas redes, o montador não arcará com as despesas dessa manutenção",
    "e tampouco ressarcirá por danos materiais que por ventura houver.",
    "",
    "Formas de pagamento: 50% no início da obra, e os 50% restantes ao final dos serviços. Pode ser realizado via",
    "PIX, transferência, cartão de débito ou cartão de crédito (nessa última modalidade, pode ser acrescido juros",
    "da operadora do cartão).",
    "",
    
  ];

  let yLegal = y + 9;
  textoLegal.forEach(linha => {
    docPDF.text(linha, 24, yLegal);
    yLegal += linha === "" ? 3 : 5;
  });

  // ── RODAPÉ ──
  const yRodape = 272;
  docPDF.setFillColor(...corFundoTopo);
  docPDF.rect(0, yRodape, W, 25, 'F');
  docPDF.setFillColor(...corOuro);
  docPDF.rect(0, yRodape, W, 0.8, 'F');
  docPDF.setFontSize(8);
  docPDF.setFont("helvetica", "normal");
  docPDF.setTextColor(160, 160, 160);
  docPDF.text("Agradecemos a preferência! Qualquer dúvida, entre em contato.", W / 2, yRodape + 7, { align: "center" });
  docPDF.text("(31) 99311-4716  |  @jd_monatagem_de_moveis_ob", W / 2, yRodape + 13, { align: "center" });
  docPDF.setFontSize(7);
  docPDF.setTextColor(100, 100, 100);
  docPDF.text(`Emitido por: ${responsavel}`, 18, yRodape + 20);
  docPDF.text(agora, W - 18, yRodape + 20, { align: "right" });

  docPDF.save(`orcamento_${cliente.replace(/\s/g, '_')}_${agora.replace(/\//g, '-')}.pdf`);
}

// ============================
// Inicializar eventos
// ============================
export function initTelaOrcamento(voltarCallback: () => void, itensExistentes?: any[]) {
  document.getElementById("addItem")?.addEventListener("click", () => adicionarItem());
  document.getElementById("salvar")?.addEventListener("click", salvarOrcamento);
  document.getElementById("gerarPDF")?.addEventListener("click", gerarPDF);
  document.getElementById("voltar")?.addEventListener("click", voltarCallback);

  // Carrega itens existentes se for edição
  if (itensExistentes?.length) {
    itensExistentes.forEach(item => adicionarItem(item));
  }
}