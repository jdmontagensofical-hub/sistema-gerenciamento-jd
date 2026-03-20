// status.ts
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { jsPDF } from "jspdf";
import { getNomeAtual, getEmailAtual } from './auth';

// ============================
// Tela Status
// ============================
export function telaStatus() {
  const hoje     = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const diaAtual = hoje.toISOString().split('T')[0];

  return `
    <section style="padding:20px;">
      <h1>Status das ORs</h1>

      <div style="margin-bottom:12px;">
        <label>Filtrar por Status:</label>
        <select id="statusFiltro" style="padding:6px; margin-left:8px;">
          <option value="">Todos</option>
          <option value="enviado">Enviado</option>
          <option value="andamento">Andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <label style="margin-left:16px;">Filtrar por OR ou Cliente:</label>
        <input type="text" id="buscaTexto" placeholder="Digite OR ou nome do cliente..."
          style="width:40%; padding:6px; margin-left:8px;" />
        <button id="btnPesquisar" style="padding:6px 16px; margin-left:8px;">Pesquisar</button>
      </div>

      <h3>Resultados</h3>
      <div id="resultadoORs" style="margin-bottom:30px;"></div>

      <hr/>

      <h3>Gerar Relatório</h3>
      <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;">
        <div>
          <label>Tipo de período:</label><br>
          <select id="tipoPeriodoRelatorio" style="padding:6px; margin-top:4px;">
            <option value="dia">Por dia</option>
            <option value="mes">Por mês</option>
            <option value="semana">Esta semana</option>
            <option value="ano">Por ano</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
        <div id="seletorDia">
          <label>Data:</label><br>
          <input type="date" id="dataUnicaFiltro" value="${diaAtual}" style="padding:6px; margin-top:4px;" />
        </div>
        <div id="seletorMesRelatorio" style="display:none;">
          <label>Mês/Ano:</label><br>
          <input type="month" id="mesFiltroRelatorio" value="${anoAtual}-${mesAtual}" style="padding:6px; margin-top:4px;" />
        </div>
        <div id="seletorAnoRelatorio" style="display:none;">
          <label>Ano:</label><br>
          <input type="number" id="anoFiltroRelatorio" value="${anoAtual}" min="2020" max="2099"
            style="padding:6px; width:90px; margin-top:4px;" />
        </div>
        <div id="seletorPersonalizadoRelatorio" style="display:none; gap:8px;">
          <div>
            <label>De:</label><br>
            <input type="date" id="dataInicioRelatorio" style="padding:6px; margin-top:4px;" />
          </div>
          <div>
            <label>Até:</label><br>
            <input type="date" id="dataFimRelatorio" style="padding:6px; margin-top:4px;" />
          </div>
        </div>
        <div>
          <button id="btnPDFRelatorio" style="padding:8px 18px; margin-top:20px;">Gerar PDF</button>
        </div>
      </div>

      <button id="voltarStatus" style="margin-top:20px;">Voltar</button>
    </section>

    <div id="modalMontagem" style="
      display:none; position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.6); z-index:999; align-items:center; justify-content:center;">
      <div style="background:#1a1916; border:1px solid #444; border-radius:12px; padding:28px; width:340px;">
        <h3 style="margin-bottom:16px;">📅 Data prevista de montagem</h3>
        <p style="color:#aaa; font-size:13px; margin-bottom:16px;">
          Informe a data prevista para a montagem dos móveis desta OR.
        </p>
        <label>Data prevista:</label><br>
        <input type="date" id="inputDataMontagem" style="width:100%; padding:8px; margin-top:6px; margin-bottom:16px;" />
        <label>Horário (opcional):</label><br>
        <input type="time" id="inputHoraMontagem" style="width:100%; padding:8px; margin-top:6px; margin-bottom:20px;" />
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="btnCancelarMontagem" style="padding:8px 16px;">Cancelar</button>
          <button id="btnConfirmarMontagem" style="padding:8px 16px; background:#c8a96e; color:#000; border:none; border-radius:6px; cursor:pointer;">Confirmar</button>
        </div>
      </div>
    </div>
  `;
}

// ============================
// Controle do modal
// ============================
let _docIdPendente    = "";
let _numeroORPendente = "";
let _pesquisarFn: (() => void) | null = null;

function abrirModal(docId: string, numeroOR: string) {
  _docIdPendente    = docId;
  _numeroORPendente = numeroOR;
  document.getElementById("modalMontagem")!.style.display = "flex";

  document.getElementById("btnConfirmarMontagem")!.onclick = async () => {
    const dataInput = (document.getElementById("inputDataMontagem") as HTMLInputElement).value;
    const horaInput = (document.getElementById("inputHoraMontagem") as HTMLInputElement).value;
    if (!dataInput) { alert("Informe a data prevista de montagem!"); return; }

    const dataMontagem = Timestamp.fromDate(new Date(`${dataInput}T${horaInput || '08:00'}:00`));
    await updateDoc(doc(db, "orcamentos", _docIdPendente), {
      status:                "andamento",
      dataMontagem,
      horaMontagem:          horaInput || "",
      ultimaAlteracaoPor:    getEmailAtual(),
      ultimaAlteracaoNome:   getNomeAtual(),
      ultimaAlteracaoStatus: "andamento",
      ultimaAlteracaoEm:     Timestamp.now(),
    });

    alert(`OR ${_numeroORPendente} atualizada!`);
    fecharModal();
    if (_pesquisarFn) _pesquisarFn();
  };
}

function fecharModal() {
  document.getElementById("modalMontagem")!.style.display = "none";
  _docIdPendente    = "";
  _numeroORPendente = "";
  (document.getElementById("inputDataMontagem") as HTMLInputElement).value = "";
  (document.getElementById("inputHoraMontagem") as HTMLInputElement).value = "";
}

function converterData(d: any): Date | null {
  try {
    if (d?.toDate)  return d.toDate();
    if (d?.seconds) return new Date(d.seconds * 1000);
    if (d) { const dt = new Date(d); if (!isNaN(dt.getTime())) return dt; }
    return null;
  } catch { return null; }
}

export function initTelaStatus(voltar: () => void, editarOR?: (id: string) => void) {
  const pesquisar = () => pesquisarORs(editarOR);
  _pesquisarFn = pesquisar;

  document.getElementById("voltarStatus")?.addEventListener("click", voltar);
  document.getElementById("btnPesquisar")?.addEventListener("click", pesquisar);
  document.getElementById("btnPDFRelatorio")?.addEventListener("click", gerarPDFRelatorio);
  document.getElementById("btnCancelarMontagem")?.addEventListener("click", fecharModal);

  document.getElementById("tipoPeriodoRelatorio")?.addEventListener("change", () => {
    const tipo = (document.getElementById("tipoPeriodoRelatorio") as HTMLSelectElement).value;
    document.getElementById("seletorDia")!.style.display                    = tipo === "dia"           ? "block" : "none";
    document.getElementById("seletorMesRelatorio")!.style.display           = tipo === "mes"           ? "block" : "none";
    document.getElementById("seletorAnoRelatorio")!.style.display           = tipo === "ano"           ? "block" : "none";
    document.getElementById("seletorPersonalizadoRelatorio")!.style.display = tipo === "personalizado" ? "flex"  : "none";
  });
}

async function pesquisarORs(editarOR?: (id: string) => void) {
  const statusFiltro = (document.getElementById("statusFiltro") as HTMLSelectElement).value;
  const buscaTexto   = (document.getElementById("buscaTexto")   as HTMLInputElement).value.toLowerCase();
  const snapshot     = await getDocs(collection(db, "orcamentos"));
  const resultadoDiv = document.getElementById("resultadoORs")!;
  resultadoDiv.innerHTML = "";

  snapshot.docs.forEach(docSnap => {
    const data     = docSnap.data();
    const numeroOR = data.numeroOR ?? "";
    const cliente  = (data.cliente ?? "").toLowerCase();

    if (
      (statusFiltro === "" || data.status === statusFiltro) &&
      (buscaTexto   === "" || cliente.includes(buscaTexto) || numeroOR.includes(buscaTexto))
    ) {
      const dataMontagem    = converterData(data.dataMontagem);
      const dataMontagemStr = dataMontagem
        ? `<p style="color:#c8a96e;"><strong>📅 Montagem prevista:</strong> ${dataMontagem.toLocaleDateString('pt-BR')}${data.horaMontagem ? ' às ' + data.horaMontagem : ''}</p>`
        : '';
      
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid #aaa; padding:10px; margin-bottom:10px;";
      card.innerHTML = `
        <p><strong>OR:</strong> ${numeroOR}</p>
        <p><strong>Cliente:</strong> ${data.cliente}</p>
        <p><strong>Endereço:</strong> ${data.endereco}</p>
        ${dataMontagemStr}
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <select class="statusAtual">
            <option value="enviado"   ${data.status === "enviado"   ? "selected" : ""}>Enviado</option>
            <option value="andamento" ${data.status === "andamento" ? "selected" : ""}>Andamento</option>
            <option value="concluido" ${data.status === "concluido" ? "selected" : ""}>Concluído</option>
            <option value="cancelado" ${data.status === "cancelado" ? "selected" : ""}>Cancelado</option>
          </select>
          <button class="btnAtualizar">Atualizar Status</button>
          <button class="btnEditar">✏️ Editar</button>
        </div>
      `;
      resultadoDiv.appendChild(card);

      card.querySelector(".btnAtualizar")!.addEventListener("click", async () => {
        const novoStatus = (card.querySelector(".statusAtual") as HTMLSelectElement).value;
        if (novoStatus === "andamento" && data.status !== "andamento") {
          abrirModal(docSnap.id, numeroOR);
          return;
        }
        await updateDoc(doc(db, "orcamentos", docSnap.id), {
          status:                novoStatus,
          ultimaAlteracaoPor:    getEmailAtual(),
          ultimaAlteracaoNome:   getNomeAtual(),
          ultimaAlteracaoStatus: novoStatus,
          ultimaAlteracaoEm:     Timestamp.now(),
        });
        alert("Status atualizado!");
        pesquisarORs(editarOR);
      });

      card.querySelector(".btnEditar")!.addEventListener("click", () => {
        if (editarOR) editarOR(docSnap.id);
      });
    }
  });
}

async function buscarORsPorPeriodo(): Promise<any[]> {
  const tipo     = (document.getElementById("tipoPeriodoRelatorio") as HTMLSelectElement).value;
  const snapshot = await getDocs(collection(db, "orcamentos"));
  const hoje     = new Date();

  return snapshot.docs.filter(docSnap => {
    const dataOrc = converterData(docSnap.data().dataEntrada);
    if (!dataOrc) return false;
    if (tipo === "dia") {
      const di = (document.getElementById("dataUnicaFiltro") as HTMLInputElement).value;
      return dataOrc.toISOString().split('T')[0] === di;
    }
    if (tipo === "mes") {
      const mes = (document.getElementById("mesFiltroRelatorio") as HTMLInputElement).value;
      const [ano, m] = mes.split('-').map(Number);
      return dataOrc.getFullYear() === ano && dataOrc.getMonth() + 1 === m;
    }
    if (tipo === "semana") {
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay());
      const fim = new Date(ini);  fim.setDate(ini.getDate() + 6);
      return dataOrc >= ini && dataOrc <= fim;
    }
    if (tipo === "ano") {
      const ano = Number((document.getElementById("anoFiltroRelatorio") as HTMLInputElement).value);
      return dataOrc.getFullYear() === ano;
    }
    if (tipo === "personalizado") {
      const ini = (document.getElementById("dataInicioRelatorio") as HTMLInputElement).value;
      const fim = (document.getElementById("dataFimRelatorio")    as HTMLInputElement).value;
      if (!ini || !fim) return true;
      return dataOrc >= new Date(ini + 'T00:00:00') && dataOrc <= new Date(fim + 'T23:59:59');
    }
    return true;
  }).map(d => ({ id: d.id, ...d.data() }));
}

// ============================
// Gerar PDF do relatório (CORRIGIDO)
// ============================
async function gerarPDFRelatorio() {
  try {
    const ors = await buscarORsPorPeriodo();
    if (!ors.length) { alert("Nenhuma OR encontrada."); return; }

    const docPDF  = new jsPDF();
    const emitido = getNomeAtual();
    const agora   = new Date().toLocaleDateString('pt-BR');

    // Cabeçalho
    docPDF.setFontSize(18);
    docPDF.setFont("helvetica", "bold");
    docPDF.text("JD Montagens - Relatório de ORs", 105, 15, { align: "center" });
    
    docPDF.setFontSize(10);
    docPDF.setFont("helvetica", "normal");
    docPDF.text(`Emitido em: ${agora} por ${emitido}`, 20, 25);
    docPDF.line(20, 30, 190, 30);

    let y = 40;
    
    // Configuração das Colunas
    const colOR = 15;
    const colDesc = 35;    // Cliente/Descrição
    const colStatus = 125; // Status
    const colUnit = 155;   // Valor Unitário
    const colTotal = 178;  // Valor Total

    docPDF.setFontSize(8);
    docPDF.setFont("helvetica", "bold");
    docPDF.text("OR", colOR, y);
    docPDF.text("CLIENTE / DESCRIÇÃO DO PRODUTO", colDesc, y);
    docPDF.text("STATUS", colStatus, y);
    docPDF.text("UNIT.", colUnit, y);
    docPDF.text("TOTAL", colTotal, y);
    
    y += 3;
    docPDF.line(15, y, 195, y);
    y += 7;

    let totalGeral = 0;

    ors.forEach(or => {
      if (y > 270) { docPDF.addPage(); y = 20; }

      const vTotal = Number(or.total || 0);
      const vUnit  = Number(or.valorUnitario || 0);
      totalGeral += vTotal;

      docPDF.setFont("helvetica", "bold");
      docPDF.text(String(or.numeroOR ?? '-'), colOR, y);

      // Texto da Descrição com quebra automática
      docPDF.setFont("helvetica", "normal");
      const textoDesc = `Cliente: ${or.cliente ?? '-'}\nProduto: ${or.descricao || or.servico || or.obs || 'Não informado'}`;
      const linhas = docPDF.splitTextToSize(textoDesc, 85); // Largura de 85 unidades
      docPDF.text(linhas, colDesc, y);

      docPDF.text(String(or.status ?? '-'), colStatus, y);
      docPDF.text(`R$ ${vUnit.toFixed(2)}`, colUnit, y);
      docPDF.text(`R$ ${vTotal.toFixed(2)}`, colTotal, y);

      // Calcula o pulo do Y baseado na quantidade de linhas da descrição
      const altura = (linhas.length * 4) + 6;
      y += altura;

      docPDF.setDrawColor(230);
      docPDF.line(15, y, 195, y);
      y += 6;
      docPDF.setDrawColor(0);
    });

    y += 4;
    docPDF.setFontSize(11);
    docPDF.setFont("helvetica", "bold");
    docPDF.text(`VALOR TOTAL GERAL: R$ ${totalGeral.toFixed(2)}`, 20, y);

    docPDF.save(`relatorio_${Date.now()}.pdf`);
  } catch (e) {
    console.error(e);
    alert("Erro ao gerar PDF.");
  }
}