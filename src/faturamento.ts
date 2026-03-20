// faturamento.ts
import { db } from './firebase';
import { collection, getDocs } from "firebase/firestore";
import { jsPDF } from "jspdf";

// ============================
// Tela Faturamento
// ============================
export function telaFaturamento() {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');

  return `
    <section style="padding:20px;">
      <h1>💰 Faturamento</h1>

      <!-- Filtro de período -->
      <div style="margin-bottom:16px; display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
        <div>
          <label>Período:</label><br>
          <select id="tipoPeriodo" style="padding:6px; margin-top:4px;">
            <option value="mes">Por mês</option>
            <option value="semana">Esta semana</option>
            <option value="ano">Por ano</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>

        <div id="seletorMes">
          <label>Mês/Ano:</label><br>
          <input type="month" id="mesSelecionado" value="${anoAtual}-${mesAtual}" style="padding:6px; margin-top:4px;" />
        </div>

        <div id="seletorAno" style="display:none;">
          <label>Ano:</label><br>
          <input type="number" id="anoSelecionado" value="${anoAtual}" min="2020" max="2099" style="padding:6px; width:90px; margin-top:4px;" />
        </div>

        <div id="seletorPersonalizado" style="display:none; gap:8px; display:none;">
          <div>
            <label>De:</label><br>
            <input type="date" id="dataInicio" style="padding:6px; margin-top:4px;" />
          </div>
          <div>
            <label>Até:</label><br>
            <input type="date" id="dataFim" style="padding:6px; margin-top:4px;" />
          </div>
        </div>

        <div>
          <button id="btnFiltrar" style="padding:8px 18px; margin-top:20px;">Filtrar</button>
          <button id="btnPDFFaturamento" style="padding:8px 18px; margin-top:20px;">Gerar PDF</button>
        </div>
      </div>

      <!-- Cards de resumo -->
      <div id="cardsResumo" style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px;"></div>

      <!-- Tabela detalhada -->
      <div id="tabelaFaturamento"></div>

      <button id="voltarFaturamento" style="margin-top:20px;">Voltar</button>
    </section>
  `;
}

// ============================
// Função auxiliar: converte data do Firebase
// ============================
function converterData(dataEntrada: any): Date | null {
  try {
    if (dataEntrada?.toDate) return dataEntrada.toDate();
    if (dataEntrada?.seconds) return new Date(dataEntrada.seconds * 1000);
    if (dataEntrada) {
      const d = new Date(dataEntrada);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================
// Inicializa eventos
// ============================
export function initTelaFaturamento(voltar: () => void) {
  document.getElementById("voltarFaturamento")?.addEventListener("click", voltar);
  document.getElementById("btnFiltrar")?.addEventListener("click", carregarFaturamento);
  document.getElementById("btnPDFFaturamento")?.addEventListener("click", gerarPDFFaturamento);

  // Mostra/esconde campos conforme tipo de período
  document.getElementById("tipoPeriodo")?.addEventListener("change", () => {
    const tipo = (document.getElementById("tipoPeriodo") as HTMLSelectElement).value;
    const seletorMes = document.getElementById("seletorMes")!;
    const seletorAno = document.getElementById("seletorAno")!;
    const seletorPersonalizado = document.getElementById("seletorPersonalizado")!;

    seletorMes.style.display = tipo === "mes" ? "block" : "none";
    seletorAno.style.display = tipo === "ano" ? "block" : "none";
    seletorPersonalizado.style.display = tipo === "personalizado" ? "flex" : "none";
  });

  // Carrega automaticamente ao abrir
  carregarFaturamento();
}

// ============================
// Busca e filtra ORs do Firebase
// ============================
async function buscarORsFiltradas(): Promise<any[]> {
  const tipo = (document.getElementById("tipoPeriodo") as HTMLSelectElement).value;
  const snapshot = await getDocs(collection(db, "orcamentos"));
  const hoje = new Date();

  return snapshot.docs.filter(docSnap => {
    const data = docSnap.data();
    const dataOrc = converterData(data.dataEntrada);
    if (!dataOrc) return false;

    if (tipo === "mes") {
      const mes = (document.getElementById("mesSelecionado") as HTMLInputElement).value;
      const [ano, m] = mes.split('-').map(Number);
      return dataOrc.getFullYear() === ano && dataOrc.getMonth() + 1 === m;
    }

    if (tipo === "semana") {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      inicioSemana.setHours(0, 0, 0, 0);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6);
      fimSemana.setHours(23, 59, 59, 999);
      return dataOrc >= inicioSemana && dataOrc <= fimSemana;
    }

    if (tipo === "ano") {
      const ano = Number((document.getElementById("anoSelecionado") as HTMLInputElement).value);
      return dataOrc.getFullYear() === ano;
    }

    if (tipo === "personalizado") {
      const inicio = (document.getElementById("dataInicio") as HTMLInputElement).value;
      const fim = (document.getElementById("dataFim") as HTMLInputElement).value;
      if (!inicio || !fim) return true;
      const dataInicio = new Date(inicio + 'T00:00:00');
      const dataFim = new Date(fim + 'T23:59:59');
      return dataOrc >= dataInicio && dataOrc <= dataFim;
    }

    return true;
  }).map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

// ============================
// Carregar e renderizar faturamento
// ============================
async function carregarFaturamento() {
  const cardsDiv = document.getElementById("cardsResumo")!;
  const tabelaDiv = document.getElementById("tabelaFaturamento")!;

  cardsDiv.innerHTML = "<p>Carregando...</p>";
  tabelaDiv.innerHTML = "";

  try {
    const ors = await buscarORsFiltradas();

    if (!ors.length) {
      cardsDiv.innerHTML = "<p>Nenhuma OR encontrada no período.</p>";
      return;
    }

    // Totais por status
    const totais: Record<string, { count: number; valor: number }> = {
      enviado:   { count: 0, valor: 0 },
      andamento: { count: 0, valor: 0 },
      concluido: { count: 0, valor: 0 },
      cancelado: { count: 0, valor: 0 },
    };
    let totalGeral = 0;

    ors.forEach(or => {
      const status = or.status ?? "enviado";
      const valor = Number(or.total || 0);
      if (totais[status]) {
        totais[status].count++;
        totais[status].valor += valor;
      }
      totalGeral += valor;
    });

    // ── Cards de resumo ──
    const coresStatus: Record<string, string> = {
      enviado:   "#4a90d9",
      andamento: "#e0a840",
      concluido: "#6db88a",
      cancelado: "#e07060",
    };
    const labelsStatus: Record<string, string> = {
      enviado:   "Enviado",
      andamento: "Andamento",
      concluido: "Concluído",
      cancelado: "Cancelado",
    };

    cardsDiv.innerHTML = `
      <div style="background:#222; border:1px solid #444; border-radius:8px; padding:16px; min-width:160px;">
        <div style="font-size:11px; color:#aaa; text-transform:uppercase; letter-spacing:1px;">Total Geral</div>
        <div style="font-size:22px; font-weight:700; color:#c8a96e; margin-top:4px;">R$ ${totalGeral.toFixed(2)}</div>
        <div style="font-size:12px; color:#aaa; margin-top:4px;">${ors.length} ORs no período</div>
      </div>
      ${Object.entries(totais).map(([status, info]) => `
        <div style="background:#222; border:1px solid #444; border-radius:8px; padding:16px; min-width:140px;">
          <div style="font-size:11px; color:#aaa; text-transform:uppercase; letter-spacing:1px;">${labelsStatus[status]}</div>
          <div style="font-size:20px; font-weight:700; color:${coresStatus[status]}; margin-top:4px;">R$ ${info.valor.toFixed(2)}</div>
          <div style="font-size:12px; color:#aaa; margin-top:4px;">${info.count} OR${info.count !== 1 ? 's' : ''}</div>
        </div>
      `).join('')}
    `;

    // ── Tabela detalhada ──
    const linhas = ors
      .sort((a, b) => {
        const da = converterData(a.dataEntrada)?.getTime() ?? 0;
        const db2 = converterData(b.dataEntrada)?.getTime() ?? 0;
        return db2 - da; // mais recente primeiro
      })
      .map(or => {
        const dataOrc = converterData(or.dataEntrada);
        const dataStr = dataOrc ? dataOrc.toLocaleDateString('pt-BR') : '—';
        const valor = Number(or.total || 0);
        const coresStatus2: Record<string, string> = {
          enviado: '#4a90d9', andamento: '#e0a840',
          concluido: '#6db88a', cancelado: '#e07060'
        };
        const cor = coresStatus2[or.status] ?? '#aaa';
        return `
          <tr style="border-bottom:1px solid #333;">
            <td style="padding:10px 12px;">${or.numeroOR ?? '—'}</td>
            <td style="padding:10px 12px;">${or.cliente ?? '—'}</td>
            <td style="padding:10px 12px;">${or.telefone ?? '—'}</td>
            <td style="padding:10px 12px;">${dataStr}</td>
            <td style="padding:10px 12px;">
              <span style="background:${cor}22; color:${cor}; padding:2px 10px; border-radius:20px; font-size:12px;">
                ${labelsStatus[or.status] ?? or.status}
              </span>
            </td>
            <td style="padding:10px 12px; font-weight:600; color:#c8a96e;">R$ ${valor.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

    tabelaDiv.innerHTML = `
      <table style="width:100%; border-collapse:collapse; background:#1a1916; border:1px solid #333; border-radius:8px; overflow:hidden;">
        <thead>
          <tr style="background:#242320; border-bottom:1px solid #333;">
            <th style="padding:10px 12px; text-align:left; font-size:11px; color:#aaa; text-transform:uppercase;">OR</th>
            <th style="padding:10px 12px; text-align:left; font-size:11px; color:#aaa; text-transform:uppercase;">Cliente</th>
            <th style="padding:10px 12px; text-align:left; font-size:11px; color:#aaa; text-transform:uppercase;">Telefone</th>
            <th style="padding:10px 12px; text-align:left; font-size:11px; color:#aaa; text-transform:uppercase;">Data</th>
            <th style="padding:10px 12px; text-align:left; font-size:11px; color:#aaa; text-transform:uppercase;">Status</th>
            <th style="padding:10px 12px; text-align:left; font-size:11px; color:#aaa; text-transform:uppercase;">Valor</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr style="background:#242320; border-top:2px solid #444;">
            <td colspan="5" style="padding:12px; font-weight:600; color:#aaa;">Total do período</td>
            <td style="padding:12px; font-weight:700; font-size:16px; color:#c8a96e;">R$ ${totalGeral.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    `;

  } catch (erro) {
    console.error("Erro ao carregar faturamento:", erro);
    cardsDiv.innerHTML = "<p style='color:red;'>Erro ao carregar dados. Verifique o console.</p>";
  }
}

// ============================
// Gerar PDF do faturamento
// ============================
async function gerarPDFFaturamento() {
  try {
    const ors = await buscarORsFiltradas();

    if (!ors.length) {
      alert("Nenhuma OR encontrada no período para gerar o PDF.");
      return;
    }

    const docPDF = new jsPDF();
    const tipo = (document.getElementById("tipoPeriodo") as HTMLSelectElement).value;

    // Título
    docPDF.setFontSize(18);
    docPDF.text("JD Montagens - Relatório de Faturamento", 105, 15, { align: "center" });

    // Período
    docPDF.setFontSize(11);
    let descPeriodo = "";
    if (tipo === "mes") {
      const mes = (document.getElementById("mesSelecionado") as HTMLInputElement).value;
      descPeriodo = `Mês: ${mes}`;
    } else if (tipo === "semana") {
      descPeriodo = "Período: Esta semana";
    } else if (tipo === "ano") {
      const ano = (document.getElementById("anoSelecionado") as HTMLInputElement).value;
      descPeriodo = `Ano: ${ano}`;
    } else {
      const inicio = (document.getElementById("dataInicio") as HTMLInputElement).value;
      const fim = (document.getElementById("dataFim") as HTMLInputElement).value;
      descPeriodo = `Período: ${inicio} a ${fim}`;
    }
    docPDF.text(descPeriodo, 20, 25);
    docPDF.text(`Total de ORs: ${ors.length}`, 20, 32);
    docPDF.line(20, 36, 190, 36);

    // Totais por status
    const totais: Record<string, number> = { enviado: 0, andamento: 0, concluido: 0, cancelado: 0 };
    let totalGeral = 0;
    ors.forEach(or => {
      const valor = Number(or.total || 0);
      if (totais[or.status] !== undefined) totais[or.status] += valor;
      totalGeral += valor;
    });

    let y = 44;
    docPDF.setFontSize(12);
    docPDF.text("Resumo por status:", 20, y); y += 7;
    docPDF.setFontSize(10);
    docPDF.text(`Enviado:    R$ ${totais.enviado.toFixed(2)}`, 25, y);   y += 6;
    docPDF.text(`Andamento:  R$ ${totais.andamento.toFixed(2)}`, 25, y); y += 6;
    docPDF.text(`Concluído:  R$ ${totais.concluido.toFixed(2)}`, 25, y); y += 6;
    docPDF.text(`Cancelado:  R$ ${totais.cancelado.toFixed(2)}`, 25, y); y += 6;
    docPDF.line(20, y, 190, y); y += 8;

    // Tabela de ORs
    docPDF.setFontSize(12);
    docPDF.text("Detalhamento das ORs:", 20, y); y += 8;

    // Cabeçalho da tabela
    docPDF.setFontSize(9);
    docPDF.setFont("helvetica", "bold");
    docPDF.text("OR", 20, y);
    docPDF.text("Cliente", 50, y);
    docPDF.text("Data", 120, y);
    docPDF.text("Status", 150, y);
    docPDF.text("Valor", 178, y);
    docPDF.setFont("helvetica", "normal");
    y += 5;
    docPDF.line(20, y, 190, y); y += 5;

    // Linhas da tabela
    ors
      .sort((a, b) => {
        const da = converterData(a.dataEntrada)?.getTime() ?? 0;
        const db2 = converterData(b.dataEntrada)?.getTime() ?? 0;
        return db2 - da;
      })
      .forEach(or => {
        const dataOrc = converterData(or.dataEntrada);
        const dataStr = dataOrc ? dataOrc.toLocaleDateString('pt-BR') : '—';
        const valor = Number(or.total || 0);

        docPDF.setFontSize(9);
        docPDF.text(String(or.numeroOR ?? '—').substring(0, 12), 20, y);
        docPDF.text(String(or.cliente ?? '—').substring(0, 30), 50, y);
        docPDF.text(dataStr, 120, y);
        docPDF.text(String(or.status ?? '—'), 150, y);
        docPDF.text(`R$ ${valor.toFixed(2)}`, 175, y);
        y += 7;

        if (y > 270) {
          docPDF.addPage();
          y = 20;
        }
      });

    // Total geral
    docPDF.line(20, y, 190, y); y += 6;
    docPDF.setFontSize(12);
    docPDF.setFont("helvetica", "bold");
    docPDF.text(`Total Geral: R$ ${totalGeral.toFixed(2)}`, 20, y);

    docPDF.save(`faturamento_${tipo}_${Date.now()}.pdf`);

  } catch (erro) {
    console.error("Erro ao gerar PDF:", erro);
    alert("Erro ao gerar o PDF. Verifique o console.");
  }
}