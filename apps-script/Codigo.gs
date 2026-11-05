/**
 * Studio Equilibra Pilates · app
 * Implantação: "Executar como: usuário que acessa o app" + "Quem pode acessar: qualquer pessoa com Conta do Google".
 *
 * - Camila (administradora) entra pelo próprio e-mail e usa a planilha "Receita" do estúdio.
 * - Cada profissional entra pelo link pessoal criado pela Camila. O link fica preso à primeira conta Google
 *   que o usar; outra conta não entra, até a Camila revogar e gerar um novo link.
 * - No primeiro acesso, o app cria automaticamente uma planilha privada no Drive da profissional
 *   (alunos, agenda, histórico, mensagens). Ela não é compartilhada com ninguém e usa o espaço da conta dela.
 * - Agenda comum do estúdio: só data, horário e aparelho de cada aula (sem nome de aluno), guardados
 *   nas propriedades do script, para respeitar o limite de aparelhos entre todas as profissionais.
 */
const ADMIN_EMAIL = 'dona-do-estudio@exemplo.com';
const SHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA'; // ID da planilha do estúdio (parte da URL entre /d/ e /edit)
const TAB_CLI = 'Clientes - Base';
const TAB_CLI_PROF = 'Clientes';
const TAB_REC = 'Receita';
const TAB_APP = '_app_dados';
const TZ = 'America/Sao_Paulo';
const ANO = 2026;
const CABECALHO = ['Cliente', 'CPF', 'e-mail', 'Telefone', 'Plano', 'Sessões no mês', 'Profissional', 'Precisa de recibo', 'Situação'];
const APARELHOS = ['Chair', 'Reformer', 'Cadillac', 'Barrel', 'Suspenso']; // Solo é livre e não entra no controle

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Studio Equilibra Pilates')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/* ---------------- Equipe e identificação ---------------- */
function props_() { return PropertiesService.getScriptProperties(); }
function email_() { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); }
function agora_() { return Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'); }
function hoje_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function comLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function equipe_() {
  const t = props_().getProperty('EQUIPE');
  if (t) return JSON.parse(t);
  const e = [{ id: 'carol', nome: 'Camila', conta: ADMIN_EMAIL, cor: 1, admin: true }];
  salvaEquipe_(e);
  return e;
}
function salvaEquipe_(e) { props_().setProperty('EQUIPE', JSON.stringify(e)); }
function mascara_(em) { const p = String(em).split('@'); return p[0].slice(0, 2) + '•••@' + (p[1] || ''); }

/** Camila pelo e-mail; profissionais pelo link pessoal, preso a uma única conta Google. */
function ident_(token, registrar) {
  const em = email_();
  if (!em) throw new Error('Entre com uma conta Google para usar o app.');
  if (em === ADMIN_EMAIL) return { admin: true, email: em, m: equipe_().filter(function (x) { return x.admin; })[0] };
  if (!token) throw new Error('Acesso não autorizado. Abra o app pelo link pessoal que a Camila te enviou.');
  return comLock_(function () {
    const eq = equipe_();
    const m = eq.filter(function (x) { return !x.admin && x.token === token; })[0];
    if (!m) throw new Error('Este link não é mais válido. Peça um novo link à Camila.');
    if (m.conta && m.conta !== em)
      throw new Error('Este link já está vinculado a outra conta Google (' + mascara_(m.conta) + '). Cada link vale para uma única pessoa. Se você trocou de conta, peça um novo link à Camila.');
    if (!m.conta || registrar) {
      if (!m.conta) { m.conta = em; m.desde = agora_(); }
      m.ultimo = agora_();
      salvaEquipe_(eq);
    }
    return { admin: false, email: em, m: m };
  });
}
function admin_(token) {
  const w = ident_(token);
  if (!w.admin) throw new Error('Somente a administradora pode criar ou revogar acessos.');
  return w;
}

/** Planilha da pessoa: a do estúdio para a Camila; para a profissional, a planilha privada no Drive dela. */
function abrir_(w) {
  if (w.admin) return SpreadsheetApp.openById(SHEET_ID);
  if (w.m.arquivo) {
    try { const ss = SpreadsheetApp.openById(w.m.arquivo); prepara_(ss); return ss; } catch (e) { /* cria outra abaixo */ }
  }
  const ss = SpreadsheetApp.create('Studio Equilibra · Agenda de ' + w.m.nome);
  prepara_(ss);
  comLock_(function () {
    const eq = equipe_();
    const m = eq.filter(function (x) { return x.id === w.m.id; })[0];
    if (m) { m.arquivo = ss.getId(); salvaEquipe_(eq); }
  });
  w.m.arquivo = ss.getId();
  return ss;
}

function prepara_(ss) {
  let c = ss.getSheetByName(TAB_CLI_PROF);
  if (!c) {
    const primeira = ss.getSheets()[0];
    if (ss.getSheets().length === 1 && primeira.getLastRow() === 0) { c = primeira; c.setName(TAB_CLI_PROF); }
    else c = ss.insertSheet(TAB_CLI_PROF, 0);
  }
  if (c.getLastRow() === 0) {
    c.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]).setFontWeight('bold');
    c.setFrozenRows(1);
  }
  appSheet_(ss);
}

/* ---------------- Armazenamento interno (na planilha de cada pessoa) ---------------- */
function appSheet_(ss) {
  let sh = ss.getSheetByName(TAB_APP);
  if (!sh) {
    sh = ss.insertSheet(TAB_APP);
    sh.getRange('A1').setValue('Dados internos do app Studio Equilibra (agenda, histórico, mensagens). Não editar.');
    sh.hideSheet();
  }
  return sh;
}
function readState_(ss) {
  const sh = appSheet_(ss);
  const n = sh.getLastRow();
  if (n < 2) return null;
  const txt = sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return r[0]; }).join('');
  return txt || null;
}
function writeState_(ss, json) {
  const sh = appSheet_(ss);
  const n = sh.getLastRow();
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).clearContent();
  const parts = [];
  for (let i = 0; i < json.length; i += 40000) parts.push([json.slice(i, i + 40000)]);
  if (parts.length) sh.getRange(2, 1, parts.length, 1).setNumberFormat('@').setValues(parts);
}

/* ---------------- Agenda comum do estúdio (sem dados de alunos) ----------------
   Cada aula vira "AAMMDDhhA": data, horário (2 dígitos) e aparelho (índice). Ex.: 261013081 */
function cod_(x) {
  const e = APARELHOS.indexOf(x[2]);
  if (e < 0) return '';
  return String(x[0]).replace(/-/g, '').slice(2) + ('0' + x[1]).slice(-2) + e;
}
function decod_(s) {
  return { date: '20' + s.slice(0, 2) + '-' + s.slice(2, 4) + '-' + s.slice(4, 6), slot: Number(s.slice(6, 8)), eq: APARELHOS[Number(s.slice(8))] };
}
function readOcup_() {
  const all = props_().getProperties();
  const h = hoje_();
  const out = { lista: [], ativos: {} };
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('OCN_') !== 0) return;
    const id = k.slice(4);
    let meta = {}; try { meta = JSON.parse(all[k]); } catch (e) { return; }
    out.ativos[id] = meta.ativos || 0;
    let txt = '';
    for (let i = 0; i < (meta.n || 0); i++) txt += all['OC_' + id + '_' + i] || '';
    txt.split(',').forEach(function (s) {
      if (s.length !== 9) return;
      const o = decod_(s);
      if (o.date >= h) { o.prof = id; out.lista.push(o); }
    });
  });
  return out;
}
function writeOcup_(id, lista, ativos) {
  const h = hoje_();
  const txt = (lista || []).filter(function (x) { return x[0] >= h; }).map(cod_).filter(String).join(',');
  const p = props_();
  let velho = {}; try { velho = JSON.parse(p.getProperty('OCN_' + id) || '{}'); } catch (e) { velho = {}; }
  const novo = {};
  let n = 0;
  for (let i = 0; i < txt.length; i += 8000) novo['OC_' + id + '_' + (n++)] = txt.slice(i, i + 8000);
  novo['OCN_' + id] = JSON.stringify({ n: n, ativos: ativos || 0, at: agora_() });
  p.setProperties(novo);
  for (let i = n; i < (velho.n || 0); i++) p.deleteProperty('OC_' + id + '_' + i);
}
function delOcup_(id) {
  const p = props_();
  let velho = {}; try { velho = JSON.parse(p.getProperty('OCN_' + id) || '{}'); } catch (e) { velho = {}; }
  for (let i = 0; i < (velho.n || 0); i++) p.deleteProperty('OC_' + id + '_' + i);
  p.deleteProperty('OCN_' + id);
}
function ocupOutros_(w, oc) { return oc.lista.filter(function (x) { return x.prof !== w.m.id; }); }

/** Atualiza só a agenda comum (usado ao abrir um agendamento). */
function ocupAtual(token) {
  const w = ident_(token);
  return JSON.stringify(ocupOutros_(w, readOcup_()));
}

function equipeOut_(w, oc) {
  oc = oc || readOcup_();
  const url = ScriptApp.getService().getUrl();
  return equipe_().map(function (m) {
    const o = { id: m.id, nome: m.nome, cor: m.cor || 1, admin: !!m.admin, ativos: oc.ativos[m.id] || 0 };
    if (w.admin) {
      o.conta = m.admin ? ADMIN_EMAIL : (m.conta || '');
      o.desde = m.desde || ''; o.ultimo = m.ultimo || '';
      if (!m.admin) o.link = url + '?k=' + m.token;
    }
    return o;
  });
}

/* ---------------- Planilha ---------------- */
function fmtData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM');
  return String(v == null ? '' : v).trim();
}
function linhaTotal_(rc) {
  const a = rc.getRange(1, 1, rc.getLastRow(), 1).getValues();
  for (let r = 0; r < a.length; r++) if (String(a[r][0]).trim() === 'Total do mês') return r + 1;
  return rc.getLastRow() + 1;
}

/** Carrega os dados de quem está usando + a agenda comum do estúdio. */
function loadAll(token) {
  const w = ident_(token, true);
  const ss = abrir_(w);
  const cb = ss.getSheetByName(w.admin ? TAB_CLI : TAB_CLI_PROF);
  const cv = cb.getRange(1, 1, Math.max(cb.getLastRow(), 1), 9).getDisplayValues();
  const rec = {};
  if (w.admin) {
    const rc = ss.getSheetByName(TAB_REC);
    const rv = rc.getRange(1, 1, Math.max(rc.getLastRow(), 1), 26).getValues();
    for (let r = 2; r < rv.length; r++) {
      const nome = String(rv[r][0] || '').trim();
      if (!nome) continue;
      if (nome === 'Total do mês') break;
      const meses = [];
      for (let i = 0; i < 12; i++) {
        const d = rv[r][2 + 2 * i], v = rv[r][3 + 2 * i];
        const temV = v !== '' && v !== null;
        meses.push(!temV && !d ? null : { d: fmtData_(d), v: Number(v) || 0 });
      }
      rec[nome] = { row: r + 1, cpf: String(rv[r][1] || '').trim(), meses: meses };
    }
  }
  const clients = [];
  for (let r = 1; r < cv.length; r++) {
    const nome = String(cv[r][0] || '').trim();
    if (!nome) continue;
    clients.push({
      nome: nome, cpf: cv[r][1], email: cv[r][2], tel: cv[r][3], plano: cv[r][4],
      sessoes: Number(cv[r][5]) || 0, prof: cv[r][6], recibo: cv[r][7], situacao: cv[r][8],
      rowC: r + 1, rec: rec[nome] || null
    });
  }
  const oc = readOcup_();
  return JSON.stringify({
    clients: clients,
    state: readState_(ss),
    me: w.m.id,
    admin: w.admin,
    email: w.email,
    dono: ADMIN_EMAIL,
    equipe: equipeOut_(w, oc),
    ocup: ocupOutros_(w, oc),
    tpl: w.admin ? null : props_().getProperty('TPL'),
    hoje: hoje_()
  });
}

/** Grava as alterações de quem está usando, sempre na planilha dessa pessoa. */
function sync(payloadJson, token) {
  const w = ident_(token);
  const p = JSON.parse(payloadJson);
  const ss = abrir_(w);
  const cb = ss.getSheetByName(w.admin ? TAB_CLI : TAB_CLI_PROF);
  const rc = w.admin ? ss.getSheetByName(TAB_REC) : null;
  const novos = {};

  (p.clientes || []).forEach(function (c) {
    let rowC = c.rowC, rowR = c.rowR;
    if (!rowC) rowC = cb.getLastRow() + 1;
    cb.getRange(rowC, 1, 1, 9).setNumberFormat('@').setValues([[
      c.nome, c.cpf || '', c.email || '', c.tel || '', c.plano || '',
      c.sessoes ? String(c.sessoes) : '', w.m.nome,
      c.precisaRecibo === false ? 'Não' : 'Sim', c.inativo ? 'Inativo' : 'Ativo'
    ]]);
    if (w.admin) {
      if (!rowR) {
        const tot = linhaTotal_(rc);
        const vazia = tot > 3 && String(rc.getRange(tot - 1, 1).getValue()).trim() === '';
        const alvo = vazia ? tot - 1 : tot;
        rc.insertRowBefore(alvo);
        rowR = alvo;
        if (rowR > 3) rc.getRange(rowR - 1, 1, 1, 27).copyTo(rc.getRange(rowR, 1, 1, 27), { formatOnly: true });
        const cols = [];
        for (let i = 0; i < 12; i++) cols.push(rc.getRange(rowR, 4 + 2 * i).getA1Notation());
        rc.getRange(rowR, 27).setFormula('=' + cols.join('+'));
        const nt = linhaTotal_(rc);
        for (let i = 0; i < 12; i++) {
          const col = rc.getRange(1, 4 + 2 * i).getA1Notation().replace(/\d+/g, '');
          rc.getRange(nt, 4 + 2 * i).setFormula('=SUM(' + col + '3:' + col + (nt - 1) + ')');
        }
      }
      rc.getRange(rowR, 1, 1, 2).setNumberFormat('@').setValues([[c.nome, c.cpf || '']]);
    }
    novos[c.key] = { rowC: rowC, rowR: rowR || null };
  });

  if (w.admin) (p.pagamentos || []).forEach(function (x) {
    const cd = rc.getRange(x.rowR, 3 + 2 * x.i);
    const cvv = rc.getRange(x.rowR, 4 + 2 * x.i);
    if (x.d) {
      const pr = String(x.d).split('/');
      cd.setValue(new Date(ANO, Number(pr[1]) - 1, Number(pr[0]))).setNumberFormat('dd/mm');
    } else cd.clearContent();
    if (x.v === null || x.v === undefined) cvv.clearContent();
    else cvv.setValue(Number(x.v)).setNumberFormat('"R$" #,##0.00');
  });

  if (p.state) writeState_(ss, p.state);
  if (p.ocup) comLock_(function () { writeOcup_(w.m.id, p.ocup.l, p.ocup.n); });
  if (w.admin && p.tpl) props_().setProperty('TPL', p.tpl);
  return JSON.stringify({ ok: true, novos: novos, ocup: ocupOutros_(w, readOcup_()) });
}

/* ---------------- Gestão de acessos (só a Camila) ---------------- */
function nomeLivre_(eq, nome, id) {
  const n = nome.toLowerCase();
  if (eq.some(function (x) { return x.id !== id && String(x.nome).toLowerCase() === n; }))
    throw new Error('Já existe alguém com esse nome na equipe.');
}
function novoToken_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }

function addProf(json, token) {
  const w = admin_(token);
  const d = JSON.parse(json);
  const nome = String(d.nome || '').trim();
  if (!nome) throw new Error('Informe o nome.');
  return comLock_(function () {
    const eq = equipe_();
    nomeLivre_(eq, nome, '');
    eq.push({ id: 'p' + Date.now().toString(36), nome: nome, cor: Number(d.cor) || 2, token: novoToken_(), criado: agora_() });
    salvaEquipe_(eq);
    return JSON.stringify(equipeOut_(w));
  });
}

function updProf(json, token) {
  const w = admin_(token);
  const d = JSON.parse(json);
  const nome = String(d.nome || '').trim();
  if (!nome) throw new Error('Informe o nome.');
  return comLock_(function () {
    const eq = equipe_();
    const m = eq.filter(function (x) { return x.id === d.id && !x.admin; })[0];
    if (!m) throw new Error('Profissional não encontrada.');
    nomeLivre_(eq, nome, m.id);
    m.nome = nome; m.cor = Number(d.cor) || m.cor;
    salvaEquipe_(eq);
    return JSON.stringify(equipeOut_(w));
  });
}

/** Revoga o link atual: o antigo para de funcionar e o novo fica livre para ser vinculado a uma conta. */
function novoLink(id, token) {
  const w = admin_(token);
  return comLock_(function () {
    const eq = equipe_();
    const m = eq.filter(function (x) { return x.id === id && !x.admin; })[0];
    if (!m) throw new Error('Profissional não encontrada.');
    m.token = novoToken_(); m.conta = ''; m.desde = ''; m.ultimo = '';
    salvaEquipe_(eq);
    return JSON.stringify(equipeOut_(w));
  });
}

function delProf(id, token) {
  const w = admin_(token);
  return comLock_(function () {
    salvaEquipe_(equipe_().filter(function (x) { return x.admin || x.id !== id; }));
    delOcup_(id);
    return JSON.stringify(equipeOut_(w));
  });
}
