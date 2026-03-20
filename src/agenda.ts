// agenda.ts
import { db } from './firebase';
import { collection, getDocs } from "firebase/firestore";
import { jsPDF } from "jspdf";

// ============================
// Função auxiliar: converte data do Firebase
// ============================
function converterData(dataEntrada: any): Date | null {
  try {
    if (dataEntrada?.toDate)  return dataEntrada.toDate();
    if (dataEntrada?.seconds) return new Date(dataEntrada.seconds * 1000);
    if (dataEntrada) {
      const d = new Date(dataEntrada);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  } catch { return null; }
}

// ============================
// Tela Agenda
// ============================
export function telaAgenda() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];

  return `
    <section style="padding:20px;">
      <h1>📋 Agenda do Funcionário</h1>
      <p style="color:#aaa; font-size:13px; margin-bottom:20px;">
        Gera a agenda de montagens do dia seguinte e envia pelo WhatsApp.
      </p>

      <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-bottom:20px;">
        <div>
          <label>Data da agenda:</label><br>
          <input type="date" id="dataAgenda" value="${amanhaStr}"
            style="padding:8px; margin-top:4px; font-size:14px;" />
        </div>
        <div>
          <label>WhatsApp do funcionário:</label><br>
          <input type="text" id="whatsappFuncionario" placeholder="Ex: 5531999990000"
            style="padding:8px; margin-top:4px; width:200px; font-size:14px;" />
          <div style="font-size:11px; color:#888; margin-top:3px;">
            Código do país + DDD + número (sem espaços ou traços)
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button id="btnPreviewAgenda" style="padding:8px 16px; margin-top:20px;">
            👁 Visualizar
          </button>
          <button id="btnPDFAgenda" style="padding:8px 16px; margin-top:20px;">
            📄 Gerar PDF
          </button>
          <button id="btnWhatsAgenda" style="padding:8px 16px; margin-top:20px; background:#25d366; color:#fff; border:none; border-radius:6px; cursor:pointer;">
            📱 Enviar WhatsApp
          </button>
        </div>
      </div>

      <!-- Preview da agenda -->
      <div id="previewAgenda"></div>

      <button id="voltarAgenda" style="margin-top:24px;">Voltar</button>
    </section>
  `;
}

// ============================
// Inicializa eventos
// ============================
export function initTelaAgenda(voltar: () => void) {
  document.getElementById("voltarAgenda")?.addEventListener("click", voltar);
  document.getElementById("btnPreviewAgenda")?.addEventListener("click", previewAgenda);
  document.getElementById("btnPDFAgenda")?.addEventListener("click", gerarPDFAgenda);
  document.getElementById("btnWhatsAgenda")?.addEventListener("click", enviarWhatsApp);
}

// ============================
// Busca ORs em andamento para a data escolhida
// ============================
async function buscarORsDoDia(): Promise<any[]> {
  const dataInput = (document.getElementById("dataAgenda") as HTMLInputElement).value;
  if (!dataInput) return [];

  const snapshot = await getDocs(collection(db, "orcamentos"));

  return snapshot.docs
    .filter(docSnap => {
      const data = docSnap.data();
      if (data.status !== "andamento") return false;
      const dataMontagem = converterData(data.dataMontagem);
      if (!dataMontagem) return false;
      return dataMontagem.toISOString().split('T')[0] === dataInput;
    })
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) => {
      // Ordena por horário
      const ha = a.horaMontagem ?? "00:00";
      const hb = b.horaMontagem ?? "00:00";
      return ha.localeCompare(hb);
    });
}

// ============================
// Preview na tela
// ============================
async function previewAgenda() {
  const previewDiv = document.getElementById("previewAgenda")!;
  previewDiv.innerHTML = "<p>Carregando...</p>";

  const dataInput = (document.getElementById("dataAgenda") as HTMLInputElement).value;
  const ors = await buscarORsDoDia();

  if (!ors.length) {
    previewDiv.innerHTML = `
      <div style="background:#2a2a2a; border:1px solid #444; border-radius:8px; padding:20px; color:#aaa; text-align:center;">
        Nenhuma montagem encontrada para ${new Date(dataInput + 'T12:00:00').toLocaleDateString('pt-BR')}.
      </div>`;
    return;
  }

  const dataFormatada = new Date(dataInput + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const cards = ors.map((or, i) => {
    const horario = or.horaMontagem ? `🕐 ${or.horaMontagem}` : '🕐 Horário não definido';
    const valor   = Number(or.total || 0);
    const obs     = or.observacoes ? `<p style="color:#aaa; font-size:12px; margin-top:6px;">📝 ${or.observacoes}</p>` : '';

    return `
      <div style="background:#1a1916; border:1px solid #444; border-radius:8px; padding:16px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:700; font-size:15px; color:#c8a96e;">${i + 1}ª montagem — ${horario}</span>
          <span style="font-size:12px; color:#888;">OR: ${or.numeroOR ?? '—'}</span>
        </div>
        <p style="margin:4px 0;"><strong>👤 Cliente:</strong> ${or.cliente ?? '—'}</p>
        <p style="margin:4px 0;"><strong>📞 Telefone:</strong> ${or.telefone ?? '—'}</p>
        <p style="margin:4px 0;"><strong>📍 Endereço:</strong> ${or.endereco ?? '—'}</p>
        <p style="margin:4px 0;"><strong>💰 Valor:</strong> R$ ${valor.toFixed(2)}</p>
        ${obs}
      </div>
    `;
  }).join('');

  previewDiv.innerHTML = `
    <div style="background:#242320; border:1px solid #555; border-radius:10px; padding:20px;">
      <h3 style="margin-bottom:16px; color:#c8a96e;">
        📋 Agenda — ${dataFormatada}
      </h3>
      <p style="color:#aaa; margin-bottom:16px;">${ors.length} montagem(ns) agendada(s)</p>
      ${cards}
    </div>
  `;
}

// ============================
// Gerar PDF da agenda
// ============================
async function gerarPDFAgenda() {
  const dataInput = (document.getElementById("dataAgenda") as HTMLInputElement).value;
  const ors = await buscarORsDoDia();

  if (!ors.length) {
    alert("Nenhuma montagem encontrada para esta data.");
    return;
  }

  const dataFormatada = new Date(dataInput + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const docPDF = new jsPDF();

  // Cabeçalho
  docPDF.setFontSize(18);
  docPDF.text("JD Montagens", 105, 15, { align: "center" });
  docPDF.setFontSize(13);
  docPDF.text(`Agenda de Montagens`, 105, 23, { align: "center" });
  docPDF.setFontSize(11);
  docPDF.text(dataFormatada, 105, 30, { align: "center" });
  docPDF.line(20, 34, 190, 34);

  let y = 42;

  ors.forEach((or, i) => {
    const horario  = or.horaMontagem ? or.horaMontagem : 'Horário não definido';
    const valor    = Number(or.total || 0);

    // Número da montagem + horário
    docPDF.setFontSize(12);
    docPDF.setFont("helvetica", "bold");
    docPDF.text(`${i + 1}ª Montagem — ${horario}`, 20, y);
    docPDF.setFont("helvetica", "normal");
    y += 7;

    docPDF.setFontSize(10);
    docPDF.text(`OR:        ${or.numeroOR ?? '—'}`, 25, y); y += 6;
    docPDF.text(`Cliente:   ${or.cliente  ?? '—'}`, 25, y); y += 6;
    docPDF.text(`Telefone:  ${or.telefone ?? '—'}`, 25, y); y += 6;
    docPDF.text(`Endereço:  ${or.endereco ?? '—'}`, 25, y); y += 6;
    docPDF.text(`Valor:     R$ ${valor.toFixed(2)}`, 25, y); y += 6;

    if (or.observacoes) {
      docPDF.text(`Obs:       ${String(or.observacoes).substring(0, 80)}`, 25, y); y += 6;
    }

    docPDF.line(20, y, 190, y);
    y += 8;

    if (y > 265) { docPDF.addPage(); y = 20; }
  });

  docPDF.setFontSize(10);
  docPDF.setTextColor(150);
  docPDF.text(`Total de montagens: ${ors.length}`, 20, y + 4);
  docPDF.setTextColor(0);

  docPDF.save(`agenda_${dataInput}.pdf`);
}

// ============================
// Montar texto da mensagem WhatsApp
// ============================
async function montarMensagem(): Promise<string> {
  const dataInput = (document.getElementById("dataAgenda") as HTMLInputElement).value;
  const ors = await buscarORsDoDia();

  if (!ors.length) return "";

  const dataFormatada = new Date(dataInput + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });

  let msg = `📋 *JD Montagens — Agenda do dia*\n`;
  msg    += `📅 *${dataFormatada}*\n`;
  msg    += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  ors.forEach((or, i) => {
    const horario = or.horaMontagem ? or.horaMontagem : 'Horário a confirmar';
    const valor   = Number(or.total || 0);

    msg += `*${i + 1}ª Montagem — 🕐 ${horario}*\n`;
    msg += `👤 *Cliente:* ${or.cliente ?? '—'}\n`;
    msg += `📞 *Telefone:* ${or.telefone ?? '—'}\n`;
    msg += `📍 *Endereço:* ${or.endereco ?? '—'}\n`;
    msg += `💰 *Valor:* R$ ${valor.toFixed(2)}\n`;
    if (or.observacoes) {
      msg += `📝 *Obs:* ${or.observacoes}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  msg += `Total: *${ors.length} montagem(ns)*\n`;
  msg += `_Enviado pelo sistema JD Montagens_`;

  return msg;
}

// ============================
// Enviar pelo WhatsApp
// ============================
async function enviarWhatsApp() {
  const whats = (document.getElementById("whatsappFuncionario") as HTMLInputElement).value.trim();

  if (!whats) {
    alert("Informe o WhatsApp do funcionário!\nEx: 5531999990000");
    return;
  }

  // Remove qualquer caractere que não seja número
  const numero = whats.replace(/\D/g, '');
  if (numero.length < 10) {
    alert("Número de WhatsApp inválido!\nFormato: código do país + DDD + número\nEx: 5531999990000");
    return;
  }

  const mensagem = await montarMensagem();
  if (!mensagem) {
    alert("Nenhuma montagem encontrada para esta data.");
    return;
  }

  // Codifica a mensagem para URL
  const msgCodificada = encodeURIComponent(mensagem);
  const url = `https://wa.me/${numero}?text=${msgCodificada}`;

  // Abre o WhatsApp Web numa nova aba
  window.open(url, '_blank');
}