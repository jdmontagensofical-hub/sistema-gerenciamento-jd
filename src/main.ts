// main.ts
import './style.css';
import { telaOrcamento, initTelaOrcamento, carregarParaEdicao } from './orcamento';
import { telaStatus, initTelaStatus }                           from './status';
import { telaFaturamento, initTelaFaturamento }                 from './faturamento';
import { telaAgenda, initTelaAgenda }                           from './agenda';
import { loginGoogle, logoutGoogle, observarAuth,
         getPerfilAtual, getNomeAtual, getFotoAtual, buscarPerfil } from './auth';

const app = document.getElementById("app")!;

// ============================
// Tela de Login
// ============================
function mostrarTelaLogin() {
  app.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0f0e0c;">
      <div style="background:#1a1916; border:1px solid #333; border-radius:16px; padding:48px 40px; width:360px; text-align:center;">
        <h1 style="font-size:26px; font-weight:800; color:#c8a96e; margin-bottom:4px;">JD Montagens</h1>
        <p style="color:#666; font-size:13px; margin-bottom:32px;">Sistema de gerenciamento</p>
        <button id="btnLoginGoogle" style="width:100%; padding:12px; border-radius:8px; border:1px solid #444;
          background:#242320; color:#f0ece4; font-size:14px; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:10px;">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Entrar com Google
        </button>
        <p style="color:#444; font-size:11px; margin-top:24px;">Apenas usuários autorizados podem acessar</p>
      </div>
    </div>
  `;
  document.getElementById("btnLoginGoogle")!.addEventListener("click", async () => {
    const btn = document.getElementById("btnLoginGoogle") as HTMLButtonElement;
    btn.textContent = "Entrando...";
    btn.disabled = true;
    await loginGoogle();
  });
}

// ============================
// App principal
// ============================
function mostrarApp(nome: string, foto: string, perfil: string) {
  app.innerHTML = `
    <div style="display:flex; flex-direction:column; min-height:100vh;">
      <header style="background:#1a1916; border-bottom:1px solid #2e2c28; padding:12px 24px; display:flex; align-items:center; justify-content:space-between;">
        <h1 style="font-size:18px; font-weight:800; color:#c8a96e; margin:0;">JD Montagens</h1>
        <div style="display:flex; align-items:center; gap:12px;">
          ${foto ? `<img src="${foto}" style="width:32px; height:32px; border-radius:50%; border:2px solid #c8a96e;">` : ''}
          <span style="font-size:13px; color:#aaa;">${nome}</span>
          <span style="font-size:11px; background:${perfil === 'admin' ? 'rgba(200,169,110,.2)' : 'rgba(96,152,208,.2)'}; 
            color:${perfil === 'admin' ? '#c8a96e' : '#6098d0'}; padding:2px 8px; border-radius:20px;">
            ${perfil === 'admin' ? 'Admin' : 'Funcionário'}
          </span>
          <button id="btnLogout" style="padding:6px 12px; background:transparent; border:1px solid #444; color:#aaa; border-radius:6px; cursor:pointer; font-size:12px;">Sair</button>
        </div>
      </header>

      <nav style="background:#1a1916; border-bottom:1px solid #2e2c28; padding:8px 24px; display:flex; gap:8px;" id="navMenu">
        ${perfil === 'admin' ? `
          <button class="nav-btn" data-tela="orcamento">📄 Orçamento</button>
          <button class="nav-btn" data-tela="status">🔄 Status OR</button>
          <button class="nav-btn" data-tela="faturamento">💰 Faturamento</button>
        ` : ''}
        <button class="nav-btn" data-tela="agenda">📋 Agenda</button>
      </nav>

      <main id="conteudo" style="flex:1; padding:0;"></main>
    </div>

    <style>
      .nav-btn { padding:8px 16px; border-radius:8px; border:1px solid #2e2c28; background:#242320; color:#7a7670; font-size:13px; cursor:pointer; transition:all .15s; }
      .nav-btn:hover { border-color:#c8a96e; color:#c8a96e; }
      .nav-btn.ativo { background:rgba(200,169,110,.12); color:#c8a96e; border-color:#c8a96e; }
    </style>
  `;

  document.getElementById("btnLogout")!.addEventListener("click", async () => {
    if (confirm("Deseja sair do sistema?")) await logoutGoogle();
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      navegarPara((btn as HTMLElement).dataset.tela!);
    });
  });

  const telaInicial = perfil === 'admin' ? 'orcamento' : 'agenda';
  document.querySelector(`[data-tela="${telaInicial}"]`)?.classList.add("ativo");
  navegarPara(telaInicial);
}

// ============================
// Navegar entre telas
// ============================
export function navegarPara(tela: string, params?: any) {
  const conteudo = document.getElementById("conteudo")!;

  const voltarPara = (t: string) => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("ativo"));
    document.querySelector(`[data-tela="${t}"]`)?.classList.add("ativo");
    navegarPara(t);
  };

  switch (tela) {
    case "orcamento":
      conteudo.innerHTML = telaOrcamento();
      initTelaOrcamento(() => voltarPara("orcamento"));
      break;

    case "orcamento-editar":
      // Abre tela de edição com dados carregados
      (async () => {
        const dados = await carregarParaEdicao(params.id);
        if (!dados) { alert("OR não encontrada."); return; }
        conteudo.innerHTML = telaOrcamento(dados);
        initTelaOrcamento(() => voltarPara("status"), dados.itens ?? []);
      })();
      break;

    case "status":
      conteudo.innerHTML = telaStatus();
      initTelaStatus(() => voltarPara("status"), (id: string) => navegarPara("orcamento-editar", { id }));
      break;

    case "faturamento":
      conteudo.innerHTML = telaFaturamento();
      initTelaFaturamento(() => voltarPara("faturamento"));
      break;

    case "agenda":
      conteudo.innerHTML = telaAgenda();
      initTelaAgenda(() => voltarPara("agenda"));
      break;
  }
}

// ============================
// Observa autenticação
// ============================
observarAuth(async (user) => {
  if (user) {
    const perfil = await buscarPerfil(user.email!);
    if (!perfil) { await logoutGoogle(); mostrarTelaLogin(); return; }
    sessionStorage.setItem('perfil', perfil);
    sessionStorage.setItem('nome',   user.displayName ?? 'Usuário');
    sessionStorage.setItem('foto',   user.photoURL ?? '');
    sessionStorage.setItem('email',  user.email ?? '');
    mostrarApp(user.displayName ?? 'Usuário', user.photoURL ?? '', perfil);
  } else {
    mostrarTelaLogin();
  }
});