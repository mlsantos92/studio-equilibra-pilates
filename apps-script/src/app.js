
(function(){
/* ---------- Dados reais da planilha ---------- */
/* Valores 2026 (tabela do estúdio): preço pelo número de sessões no mês */
const TABELA={1:80,2:140,3:190,4:230,5:270,6:310,7:340,8:370,9:390,10:440,11:480,12:510};
const PLANOS=["Aula livre","1x por semana","2x por semana","3x por semana"];
const PLANO_SESS={"Aula livre":[1,2,3],"1x por semana":[4,5,6,7],"2x por semana":[8,9,10,11],"3x por semana":[12]};
const sessDe=c=>c&&c.plano?(PLANO_SESS[c.plano].includes(c.sessoes)?c.sessoes:PLANO_SESS[c.plano][0]):0;
/* desconto do aluno: % ou R$ sobre o valor da tabela */
function applyDesc(c,v){const d=c&&c.desc;if(!d||!d.v)return v;return Math.max(0,Math.round(d.tipo==="pct"?v*(1-d.v/100):v-d.v));}
const descTxt=c=>c&&c.desc&&c.desc.v?(c.desc.tipo==="pct"?`-${c.desc.v}%`:`-R$ ${c.desc.v}`):"";
const planoValor=c=>c&&c.plano?applyDesc(c,TABELA[sessDe(c)]):0;
const planoPill=c=>c&&c.plano?`<span class="pill">${c.plano} · ${sessDe(c)} ${sessDe(c)>1?"sessões":"sessão"} · R$ ${planoValor(c)}${descTxt(c)?` (${descTxt(c)})`:""}</span>`:`<span class="pill warn">plano a definir</span>`;
/* sessões do aluno no mês, contadas pela agenda (aulas marcadas ou encerradas) */
function agendaSess(cid,mi){return appts.filter(a=>a.cid===cid&&parseKey(a.date).getFullYear()===2026&&parseKey(a.date).getMonth()===mi).length;}
const valorSess=n=>TABELA[Math.min(n,12)];
function sessSelect(plano,cur){if(!plano)return '<p class="note" style="margin:0">Escolha o plano para ver o valor.</p>';const op=PLANO_SESS[plano];const v=op.includes(cur)?cur:op[0];return `<label for="c-sess">Sessões no mês</label><select id="c-sess">${op.map(n=>`<option value="${n}"${n===v?" selected":""}>${n} ${n>1?"sessões":"sessão"} · R$ ${TABELA[n].toLocaleString("pt-BR")},00</option>`).join("")}</select>`;}
const MONTHS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PROFS=[{id:"carol",nome:"Camila",email:"",c:"--p1",cs:"--p1-soft",owner:true,tel:"",cor:1,ativos:0}];
const ocup=[];let TOKEN="",ADMIN=false,DONO="",MYEMAIL="",lastOcup="",lastTpl="";
const EQUIP=[{n:"Chair",q:2},{n:"Reformer",q:2},{n:"Cadillac",q:3},{n:"Barrel",q:1},{n:"Suspenso",q:2},{n:"Solo",q:Infinity}];
const SLOTS=52; // 07:00–20:00, 15 min
const fmtCPF=d=>d.length===11?d.slice(0,3)+"."+d.slice(3,6)+"."+d.slice(6,9)+"-"+d.slice(9):d;
function normCPF(raw){const d=(raw||"").replace(/\D/g,"");if(!d)return "";return fmtCPF(d.padStart(11,"0"));}
const brl=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let nid=1;
const clients=[];
const cpfCount={};
const byName=n=>clients.find(c=>c.nome===n);

/* ---------- Datas ---------- */
const pad=n=>String(n).padStart(2,"0");
const key=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseKey=k=>{const[y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d);};
const slotTime=s=>{const m=7*60+s*15;return pad(Math.floor(m/60))+":"+pad(m%60);};
let today=new Date();today.setHours(0,0,0,0);
function mondayOf(d){const x=new Date(d);const wd=x.getDay();const diff=wd===0?1:(wd===6?2:1-wd);x.setDate(x.getDate()+diff);return x;}
let weekStart=mondayOf(today);
const DOW=["Seg","Ter","Qua","Qui","Sex","Sáb"];
const SAT_END=20; // sábado 07:00–12:00
const isSat=k=>parseKey(k).getDay()===6;
const maxStart=k=>(isSat(k)?SAT_END:SLOTS)-3;
const brDate=k=>{const d=parseKey(k);return pad(d.getDate())+"/"+pad(d.getMonth()+1);};

/* ---------- Agenda e histórico de exemplo ---------- */
let aid=1;
const appts=[];

const hist={};

/* ---------- Estado ---------- */
let me="carol", tab="agenda", clientFilter="", clientScope="meus", revFilter="";
const SEM_ALUNO={id:0,nome:"Aluno não encontrado",cpf:"",email:"",tel:"",obs:"",plano:"",meses:Array(12).fill(null),inativo:true};
function cliOf(id){return clients.find(x=>x.id===id)||Object.assign({},SEM_ALUNO,{id});}
function prof(id){return PROFS.find(p=>p.id===id);}
function isOwner(){return prof(me).owner;}

/* ---------- Disponibilidade de aparelhos ---------- */
function used(date,slot,eq,exclude){let max=0;for(let b=slot;b<slot+3;b++){const n=appts.concat(ocup).filter(a=>a.date===date&&a.id!==exclude&&a.eq===eq&&b>=a.slot&&b<a.slot+3).length;if(n>max)max=n;}return max;}
const MAX_PROF=3; // alunos por profissional no mesmo horário
function profLoad(date,slot,pid,exclude){let max=0;for(let b=slot;b<slot+3;b++){const n=appts.filter(a=>a.date===date&&a.id!==exclude&&a.prof===pid&&b>=a.slot&&b<a.slot+3).length;if(n>max)max=n;}return max;}
/* Cada aparelho é usado ~15–30 min da aula: além da quantidade de aparelhos, aceita até 2 alunos extras em revezamento */
const EXTRA_AP=2;
function freeOf(date,slot,eq,exclude){const e=EQUIP.find(x=>x.n===eq);return e.q===Infinity?Infinity:e.q+EXTRA_AP-used(date,slot,eq,exclude);}
function eqLabel(e,f){if(f===Infinity)return "uso livre";if(f<=0)return "todos ocupados";const base=f-EXTRA_AP;if(base>0)return `${base} de ${e.q} livre${base>1?"s":""} · +${EXTRA_AP} revezando`;return `cheio · ${f} vaga${f>1?"s":""} revezando`;}

/* ---------- Render principal ---------- */
const $=s=>document.querySelector(s);
function renderWho(){}
function renderTabs(){
  const t=[["agenda","Agenda"],["clientes","Clientes"],["mensagens","Mensagens"]];if(isOwner()){t.push(["receita","Previsão de receita"]);t.push(["equipe","Equipe"]);}
  if(!isOwner()&&(tab==="receita"||tab==="equipe"))tab="agenda";
  $("#tabs").innerHTML=t.map(([k,l])=>`<button role="tab" aria-selected="${k===tab}" data-tab="${k}">${l}${k==="receita"||k==="equipe"?'<span class="lock">só Camila</span>':""}</button>`).join("");
}
function renderOwner(){const el=$("#owner");if(!el)return;const p=prof(me);const at=clients.filter(c=>!c.inativo).length;
  const outros=isOwner()?PROFS.filter(x=>x.id!==me).map(x=>`${esc(x.nome)}: ${x.ativos||0}`).join(" · "):"";
  el.innerHTML=`<div><small>Conta de acesso</small><b>${esc(MYEMAIL||p.email||"")}</b>${p.owner?'<span class="pill ok">Administradora</span>':`<span class="note">Profissional · ${esc(p.nome)}</span>`}</div><div><small>Alunos ativos vinculados</small><b>${at} aluno${at===1?"":"s"}</b><span class="note">de ${esc(p.nome)}${outros?" · "+outros:""}</span></div>`;}
function render(){renderOwner();autoInativa();renderWho();renderTabs();renderBanner();({agenda:renderAgenda,clientes:renderClientes,mensagens:renderMensagens,receita:renderReceita,equipe:renderEquipe})[tab]();}

/* ---------- Agenda ---------- */
function layoutDay(list){
  list.sort((a,b)=>a.slot-b.slot||a.id-b.id);
  const out=[];let cluster=[],end=-1;
  const flush=()=>{const lanes=[];cluster.forEach(a=>{let l=lanes.findIndex(e=>e<=a.slot);if(l<0){l=lanes.length;lanes.push(0);}lanes[l]=a.slot+3;a._lane=l;});cluster.forEach(a=>{a._lanes=lanes.length;out.push(a);});cluster=[];};
  list.forEach(a=>{if(a.slot>=end&&cluster.length)flush();cluster.push(a);end=Math.max(end,a.slot+3);});
  if(cluster.length)flush();return out;
}
function renderAgenda(){
  const days=[...Array(6)].map((_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d;});
  const end=days[5];
  const label=`${days[0].getDate()} a ${end.getDate()} de ${end.toLocaleDateString("pt-BR",{month:"long"})}`;
  let html=`<div class="bar"><div class="weeknav"><button class="btn" data-wk="-1" aria-label="Semana anterior">‹</button><h2>${label}</h2><button class="btn" data-wk="1" aria-label="Próxima semana">›</button></div>
  <div class="legend">${PROFS.map(p=>`<span><span class="dot" style="background:var(${p.c})"></span>${esc(p.nome)}</span>`).join("")}<span class="muted">Seg a sex 07:00–20:00 · sáb 07:00–12:00 · clique num horário vazio para agendar</span></div></div>`;
  /* largura mínima de cada aluno: o dobro da anterior (~45px -> 90px); o dia alarga quando precisa */
  const MIN_AP=90,MIN_DIA=127;
  const larg=days.map(d=>{const k=key(d);const l=layoutDay(appts.filter(a=>a.date===k).concat(ocup.filter(o=>o.date===k)));const n=l.reduce((m,a)=>Math.max(m,a._lanes||1),1);return Math.max(MIN_DIA,n*MIN_AP+4);});
  html+=`<div class="cal-scroll"><div class="cal" style="grid-template-columns:56px ${larg.map(w=>`minmax(${w}px,1fr)`).join(" ")};min-width:${56+larg.reduce((a,b)=>a+b,0)}px"><div class="dh"></div>`;
  days.forEach((d,i)=>{html+=`<div class="dh${key(d)===key(today)?" today":""}"><small>${DOW[i]}</small><b>${pad(d.getDate())}/${pad(d.getMonth()+1)}</b></div>`;});
  html+=`<div class="times">${[...Array(13)].map((_,i)=>`<div style="top:calc(var(--row)*${i*4})">${pad(7+i)}:00</div>`).join("")}</div>`;
  days.forEach(d=>{
    const k=key(d);const list=layoutDay(appts.filter(a=>a.date===k).concat(ocup.filter(o=>o.date===k)));
    html+=`<div class="day" data-day="${k}">`+(d.getDay()===6?`<div class="closed" style="top:calc(var(--row)*${SAT_END})">Sábado: só pela manhã</div>`:"")+list.map(a=>{const p=prof(a.prof)||{nome:"Profissional",c:"--p8",cs:"--p8-soft"};if(a.ocup){const w0=100/a._lanes;return `<div class="ap ocup" style="--c:var(${p.c});--cs:var(${p.cs});top:calc(var(--row)*${a.slot} + 1px);height:calc(var(--row)*3 - 2px);left:calc(${a._lane*w0}% + 2px);width:calc(${w0}% - 4px)" title="${esc(p.nome)} · ${esc(a.eq)} · horário ocupado"><b>${esc(p.nome)}</b><i>Ocupado · ${esc(a.eq)} · ${slotTime(a.slot)}</i></div>`;}const c=cliOf(a.cid);const w=100/a._lanes;
      return `<button class="ap${a.status==="concluida"?" done":""}" data-ap="${a.id}" style="--c:var(${p.c});--cs:var(${p.cs});top:calc(var(--row)*${a.slot} + 1px);height:calc(var(--row)*3 - 2px);left:calc(${a._lane*w}% + 2px);width:calc(${w}% - 4px)" title="${esc(c.nome)} · ${[a.eq,...(a.extras||[])].join(" + ")} · ${slotTime(a.slot)}–${slotTime(a.slot+3)} · ${esc(p.nome)}"><b>${esc(c.nome)}</b><i>${a.reag?"↻ ":a.serie?"↺ ":""}${[a.eq,...(a.extras||[])].join(" + ")} · ${slotTime(a.slot)}</i></button>`;}).join("")+`</div>`;
  });
  html+=`</div></div>`;
  $("#view").innerHTML=html;
}

/* ---------- Modal ---------- */
function openModal(html){$("#modal-root").innerHTML=`<div class="overlay" data-close-bg><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;const f=$("#modal-root input,#modal-root button");}
function closeModal(){$("#modal-root").innerHTML="";}
function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600);}
function histHTML(cid,n){
  const list=(hist[cid]||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,n);
  if(!list.length)return `<p class="note">Nenhuma aula registrada ainda para este aluno.</p>`;
  return `<div class="hist">`+list.map(x=>{const p=prof(x.prof);const all=[x.eq,...x.extras];return `<div class="h"><div class="meta"><b style="color:var(--ink)">${brDate(x.date)}</b><span class="dot" style="background:var(${p.c})"></span>${esc(p.nome)}${x.exemplo?'<span class="pill">exemplo</span>':""}</div>
    <div class="meta" style="margin-top:4px"><span>${all.length>1?`Aparelhos usados (${all.length}):`:"Aparelho usado:"}</span>${all.map((e,i)=>`<span class="pill ${i===0?"ok":"warn"}" title="${i===0?"Aparelho agendado":"Usado a mais na aula"}">${e}${i===0&&all.length>1?" · agendado":i>0?" · a mais":""}</span>`).join("")}</div>${x.obs?`<p>${esc(x.obs)}</p>`:""}</div>`;}).join("")+`</div>`;
}

/* Agendar */
let bk=null;
/* Mensagens automáticas */
const tpl={
  novo:"Olá, {nome}! Seja bem-vindo(a) ao Studio Equilibra. Sua primeira aula de Pilates é amanhã, {dia}, às {hora}, com {profissional}. Chegue uns 10 minutos antes e venha com roupa confortável. Até amanhã!",
  reag:"Olá, {nome}! Lembrete: sua aula no Studio Equilibra foi reagendada para amanhã, {dia}, às {hora}, com {profissional}. Se tiver alguma dúvida, é só responder esta mensagem.",
  vesp:"Oi, {nome}! Lembrete: amanhã, {dia}, às {hora} tem Pilates no Studio Equilibra com {profissional}. Até amanhã!"
};
const TIPO={novo:"Aluno novo",reag:"Reagendamento",vesp:"Lembrete padrão"};
const msgs=[]; let mid=1;
const WD=["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
const diaLongo=k=>`${WD[parseKey(k).getDay()]}, ${brDate(k)}`;
function fill(t,date,slot,pid,cid,eq){const c=clients.find(x=>x.id===cid);return t.replace(/\{nome\}/g,c?c.nome.split(/[ /(]/)[0]:"").replace(/\{dia\}/g,diaLongo(date)).replace(/\{hora\}/g,slotTime(slot)).replace(/\{profissional\}/g,prof(pid).nome).replace(/\{aparelho\}/g,eq||"a definir");}
function envio(date){const v=parseKey(vesperaKey(date));v.setHours(18,0,0,0);const atrasado=v<=new Date();return{atrasado,quando:atrasado?"agora":`${brDate(vesperaKey(date))} 18:00`,label:atrasado?"agora (passou das 18:00 da véspera)":`${diaLongo(vesperaKey(date))} às 18:00`};}
function vesperaKey(date){const d=parseKey(date);d.setDate(d.getDate()-1);return key(d);}
function waLink(tel,txt){let d=(tel||"").replace(/\D/g,"");if(d&&!d.startsWith("55"))d="55"+d;return `https://wa.me/${d}?text=${encodeURIComponent(txt)}`;}
function isNewClient(cid){const c=clients.find(x=>x.id===cid);return !(hist[cid]||[]).length&&!appts.some(a=>a.cid===cid&&a.status==="concluida")&&!(c&&c.meses.some(Boolean));}
function msgDefaults(){if(bk.msgTouched)return;bk.msgOn=!!bk.reschedId||(bk.cid?isNewClient(bk.cid):false);}

const DIAS_CURTOS=["seg","ter","qua","qui","sex","sáb"];
const dIdx=k=>(parseKey(k).getDay()+6)%7; // 0=seg … 5=sáb
let sid=1; const series={};
function newRec(){const r={on:false,weeks:12,days:[...Array(6)].map(()=>({on:false,slot:bk.slot}))};r.days[dIdx(bk.date)]={on:true,slot:bk.slot};return r;}
function recOccurrences(){
  /* Recorrência: a 1ª aula usa o aparelho escolhido; as seguintes ficam em Solo (ajustável depois).
     O limite de 3 alunos por profissional não bloqueia a série; só sinaliza. */
  const r=bk.rec;const mon=parseKey(bk.date);mon.setDate(mon.getDate()-dIdx(bk.date));
  const ok=[],lotadas=[];
  for(let w=0;w<r.weeks;w++)for(let i=0;i<6;i++){const dd=r.days[i];if(!dd.on)continue;
    const d=new Date(mon);d.setDate(d.getDate()+w*7+i);const k=key(d);if(k<bk.date)continue;
    const slot=Math.min(dd.slot,maxStart(k));
    let eq="Solo";if(!ok.length&&bk.eq&&freeOf(k,slot,bk.eq)>0)eq=bk.eq;
    const o={date:k,slot,eq};ok.push(o);
    if(profLoad(k,slot,bk.prof)>=MAX_PROF)lotadas.push(o);}
  return {ok,lotadas};
}
function recLabel(s){return s.days.map((d,i)=>d.on?`${DIAS_CURTOS[i]} ${slotTime(d.slot)}`:"").filter(Boolean).join(" · ");}

function openBooking(date,slot){
  if(slot>maxStart(date))return;
  bk={date,slot,prof:me,cid:null,eq:"Solo",q:"",scope:"meus",msgOn:false,msgTouched:false,canal:"whatsapp",msgTxt:null};bk.rec=newRec();drawBooking();refreshOcup();
}
function openReschedule(id){
  const a=appts.find(x=>x.id===id);
  bk={date:a.date,slot:a.slot,prof:a.prof,cid:a.cid,eq:a.eq,q:"",scope:"todos",reschedId:a.id,orig:{date:a.date,slot:a.slot},msgOn:true,msgTouched:false,canal:"whatsapp",msgTxt:null};drawBooking();refreshOcup();
}
function drawBooking(){
  const d=parseKey(bk.date);const ex=bk.reschedId;const wd=d.getDay();const weekend=wd===0;
  if(!weekend&&bk.slot>maxStart(bk.date))bk.slot=maxStart(bk.date);
  const slotOpts=(k,cur)=>[...Array(maxStart(k)+1)].map((_,s)=>`<option value="${s}"${s===cur?" selected":""}>${slotTime(s)} – ${slotTime(s+3)}</option>`).join("");
  const q=bk.q.trim().toLowerCase();
  let pool=clients.filter(c=>bk.scope==="todos"||c.prof===bk.prof);
  if(q)pool=pool.filter(c=>c.nome.toLowerCase().includes(q)||c.cpf.includes(q));
  const sel=clients.find(c=>c.id===bk.cid);
  const load=profLoad(bk.date,bk.slot,bk.prof,ex);const recOn=!ex&&bk.rec&&bk.rec.on;const over=load>=MAX_PROF;const full=over&&!ex&&!recOn;
  const novo=sel&&isNewClient(sel.id);
  const kind=ex?"reag":novo?"novo":"vesp";
  const env=envio(bk.date);
  const txt=(bk.msgTxt!==null&&bk.msgTxt!==undefined)?bk.msgTxt:(sel?fill(tpl[kind],bk.date,bk.slot,bk.prof,bk.cid,bk.eq):"");
  const contato=sel&&sel.tel;
  const unchanged=ex&&bk.date===bk.orig.date&&bk.slot===bk.orig.slot;
  const rec=!ex&&bk.rec&&bk.rec.on;
  const occ=rec&&bk.eq?recOccurrences():null;
  const sundayRow=i=>i===5?"1":"0";
  openModal(`<h3>${ex?"Reagendar aula":"Novo agendamento"}</h3><div class="sub">${ex?`Era ${diaLongo(bk.orig.date)} às ${slotTime(bk.orig.slot)}`:diaLongo(bk.date)}</div>
  <div class="grid2"><div class="field"><label for="bk-date">${rec?"Começa em":"Dia"}</label><input type="date" id="bk-date" value="${bk.date}"></div>
  <div class="field"><label for="bk-time">Horário (45 min)</label><select id="bk-time">${slotOpts(bk.date,bk.slot)}</select></div></div>
  ${weekend?`<p class="note" style="color:var(--bad);margin:0">O estúdio atende de segunda a sexta (07:00–20:00) e sábado de manhã (07:00–12:00). Escolha outro dia.</p>`:""}
  <div class="field"><label for="bk-prof">Profissional</label><select id="bk-prof">${PROFS.filter(p=>p.id===me||p.id===bk.prof).map(p=>{const l=profLoad(bk.date,bk.slot,p.id,ex);return `<option value="${p.id}"${p.id===bk.prof?" selected":""}>${esc(p.nome)} · ${l>=MAX_PROF?"lotado":`${MAX_PROF-l} vaga${MAX_PROF-l>1?"s":""}`}</option>`;}).join("")}</select></div>
  <div class="row"><span class="pill ${full?"bad":load===MAX_PROF-1?"warn":"ok"}">${esc(prof(bk.prof).nome)}: ${load} de ${MAX_PROF} alunos neste horário</span>${full?`<span class="note" style="color:var(--bad)">Horário lotado para esta profissional. Escolha outro horário ou outra profissional.</span>`:over?`<span class="note" style="color:var(--warn)">Já tem ${MAX_PROF} alunos, mas ${ex?"reagendamentos":"aulas recorrentes"} podem passar do limite.</span>`:""}</div>
  ${ex?`<div class="field"><label>Aluno</label><div><b>${esc(sel.nome)}</b></div></div>`:`<div class="field"><label for="bk-q">Aluno</label>
   <div class="row"><input type="search" id="bk-q" placeholder="Buscar por nome ou CPF" value="${esc(bk.q)}" style="flex:1;min-width:0"><button class="btn" data-act="new-client">+ Aluno novo</button></div>
   <div class="row note"><label><input type="radio" name="bk-scope" value="meus"${bk.scope==="meus"?" checked":""}> Alunos de ${esc(prof(bk.prof).nome)}</label><label><input type="radio" name="bk-scope" value="todos"${bk.scope==="todos"?" checked":""}> Todos</label></div>
   <div class="clist">${pool.length?pool.map(c=>`<button data-pick="${c.id}" aria-pressed="${c.id===bk.cid}"><span>${esc(c.nome)}${c.inativo?' <span class="pill bad">inativo</span>':""}</span><span class="muted">${c.cpf||""}</span></button>`).join(""):`<p class="note" style="padding:8px 10px;margin:0">Nenhum aluno encontrado. Use "Aluno novo".</p>`}</div>
  </div>`}
  ${sel?`<div class="field"><label class="row" style="gap:6px">Últimas 2 aulas de ${esc(sel.nome)} ${planoPill(sel)}</label>${histHTML(sel.id,2)}</div>`:""}
  <div class="field"><label>Aparelho <span class="muted" style="font-weight:400">· Solo vem marcado e pode ser trocado agora ou depois, na própria aula</span></label><div class="eqs">${EQUIP.map(e=>{const f=freeOf(bk.date,bk.slot,e.n,ex);return `<button class="eq" data-eq="${e.n}" aria-pressed="${bk.eq===e.n}"${f<=0?" disabled":""}><b>${e.n}</b><small>${eqLabel(e,f)}</small></button>`;}).join("")}</div></div>
  ${!ex?`<div class="msgbox">
    <label class="row" style="gap:8px;font-weight:600"><input type="checkbox" id="rec-on"${rec?" checked":""}> Aluno recorrente (repetir toda semana)</label>
    ${rec?`<div class="recdays">${bk.rec.days.map((dd,i)=>`<div class="recday${dd.on?" on":""}"><label class="row" style="gap:6px"><input type="checkbox" class="rec-d" data-i="${i}"${dd.on?" checked":""}> ${DOW[i]}</label>${dd.on?`<select class="rec-t" data-i="${i}">${[...Array((i===5?SAT_END:SLOTS)-2)].map((_,s)=>`<option value="${s}"${s===dd.slot?" selected":""}>${slotTime(s)}</option>`).join("")}</select>`:""}</div>`).join("")}</div>
     <div class="row"><label for="rec-w" class="note">Repetir por</label><select id="rec-w" style="width:auto">${[4,8,12,16,24].map(n=>`<option value="${n}"${n===bk.rec.weeks?" selected":""}>${n} semanas</option>`).join("")}</select></div>
     ${occ?`<p class="note" style="margin:0"><b style="color:var(--ink)">${occ.ok.length} aulas</b> serão criadas${occ.ok.length?`, de ${brDate(occ.ok[0].date)} a ${brDate(occ.ok[occ.ok.length-1].date)}`:""}. A primeira no <b style="color:var(--ink)">${occ.ok[0]?occ.ok[0].eq:bk.eq}</b>${occ.ok[0]&&occ.ok[0].eq!==bk.eq?` (${bk.eq} ocupado nesse dia)`:""}; as seguintes em <b style="color:var(--ink)">Solo</b>, ajustáveis depois.${occ.lotadas.length?` <span style="color:var(--warn)">${occ.lotadas.length} aula${occ.lotadas.length>1?"s ficam":" fica"} com mais de ${MAX_PROF} alunos para ${esc(prof(bk.prof).nome)}: ${occ.lotadas.slice(0,4).map(o=>`${brDate(o.date)} ${slotTime(o.slot)}`).join("; ")}${occ.lotadas.length>4?"…":""}.</span>`:""}</p>`:""}`:`<p class="note" style="margin:0">Marque para já deixar as próximas semanas agendadas nos dias e horários fixos do aluno.</p>`}
  </div>`:""}
  ${sel?`<div class="msgbox">
    <div class="row" style="justify-content:space-between"><label class="row" style="gap:8px;font-weight:600"><input type="checkbox" id="bk-msg"${bk.msgOn?" checked":""}> Enviar lembrete automático ao aluno</label>
    ${ex?'<span class="pill warn">reagendamento</span>':novo?'<span class="pill ok">aluno novo</span>':'<span class="pill">aluno frequente</span>'}</div>
    ${bk.msgOn?`<div class="grid2"><div class="field"><label>Quando sai</label><div style="padding-top:6px"><b>${env.label}</b>${rec?'<div class="note">só para a primeira aula da série</div>':""}</div></div></div>
     ${env.atrasado?`<p class="note" style="color:var(--warn);margin:0">Já passou das 18:00 da véspera: o lembrete entra direto na lista para enviar.</p>`:""}
     <div class="field"><label for="bk-msgtxt">Mensagem (${TIPO[kind].toLowerCase()})</label><textarea id="bk-msgtxt" rows="4">${esc(txt)}</textarea>${bk.msgTxt!==null?`<button class="btn ghost" data-act="reset-msg" style="align-self:flex-start;padding:2px 0;font-size:12.5px">Voltar ao texto padrão</button>`:""}</div>
     <p class="note" style="margin:0">Na hora do envio, o botão abre o WhatsApp do celular com esta mensagem pronta${contato?` e já no contato ${esc(contato)}`:"; é só escolher o contato do aluno e enviar"}.</p>`:`<p class="note" style="margin:0">Vem marcado para alunos novos e reagendamentos. O lembrete sai sempre às 18:00 do dia anterior à aula.</p>`}
  </div>`:""}
  <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" data-act="save-booking"${bk.cid&&bk.eq&&!full&&!weekend&&!unchanged&&(!rec||(occ&&occ.ok.length))?"":" disabled"}>${ex?"Reagendar":rec&&occ?`Agendar ${occ.ok.length} aulas`:"Agendar"}</button></div>`);
  const qi=$("#bk-q");if(qi&&document.activeElement!==qi&&bk._focusQ){qi.focus();qi.setSelectionRange(qi.value.length,qi.value.length);}
}
function saveBooking(){
  const ex=bk.reschedId;
  if(!ex&&!(bk.rec&&bk.rec.on)&&profLoad(bk.date,bk.slot,bk.prof)>=MAX_PROF){toast(`${prof(bk.prof).nome} já tem ${MAX_PROF} alunos neste horário`);return;}
  let a,created=[],lotadas=[];
  if(ex){a=appts.find(x=>x.id===ex);Object.assign(a,{date:bk.date,slot:bk.slot,prof:bk.prof,eq:bk.eq,reag:true});
    msgs.forEach(m=>{if(m.aid===a.id&&m.status==="agendada")m.status="cancelada";});}
  else if(bk.rec&&bk.rec.on){const occ=recOccurrences();const s=sid++;series[s]={days:bk.rec.days.map(x=>({...x})),cid:bk.cid,prof:bk.prof,weeks:bk.rec.weeks};
    occ.ok.forEach(o=>{const n={id:aid++,date:o.date,slot:o.slot,prof:bk.prof,cid:bk.cid,eq:o.eq,status:"agendada",serie:s};appts.push(n);created.push(n);});
    lotadas=occ.lotadas;a=created[0];series[s].fim=created.length?created[created.length-1].date:bk.date;}
  else{a={id:aid++,date:bk.date,slot:bk.slot,prof:bk.prof,cid:bk.cid,eq:bk.eq,status:"agendada"};appts.push(a);created=[a];}
  const c=clients.find(x=>x.id===bk.cid);
  if(c.inativo){c.pausa=null;c.reativadoEm=key(today);c.inativo=false;c.inativoAuto=false;setTimeout(()=>toast(`${c.nome} foi reativado(a)`),2700);}
  renderAgenda();
  const recInfo=created.length>1?`<div class="row"><span class="pill ok">${created.length} aulas agendadas · ${esc(recLabel(series[a.serie]))}</span><span class="pill">até ${brDate(created[created.length-1].date)}</span></div><p class="note" style="margin:0">Primeira aula no ${created[0].eq}; as seguintes em Solo. Para trocar, clique na aula na agenda.</p>${lotadas.length?`<p class="note" style="color:var(--warn);margin:0">Passam de ${MAX_PROF} alunos para ${esc(prof(created[0].prof).nome)}: ${lotadas.map(o=>`${brDate(o.date)} ${slotTime(o.slot)}`).join("; ")}.</p>`:""}`:"";
  if(!bk.msgOn){if(created.length>1){openModal(`<h3>Aulas recorrentes agendadas</h3><div class="sub">${esc(c.nome)} · ${esc(prof(a.prof).nome)}</div>${recInfo}<div class="actions"><button class="btn primary" data-act="close">Concluir</button></div>`);return;}
    closeModal();toast(ex?`Aula de ${c.nome} reagendada`:`${c.nome} agendado(a) às ${slotTime(bk.slot)} no ${bk.eq}`);return;}
  const kind=ex?"reag":isNewClient(c.id)?"novo":"vesp";
  const txt=(bk.msgTxt!==null&&bk.msgTxt!==undefined)?bk.msgTxt:fill(tpl[kind],a.date,a.slot,a.prof,a.cid,a.eq);

  const env=envio(a.date);
  const status="agendada";
  msgs.unshift({id:mid++,aid:a.id,cid:c.id,tipo:kind,canal:bk.canal,quando:env.quando,status,texto:txt,prof:a.prof});
  const wa=waLink(c.tel,txt);
  openModal(`<h3>${ex?"Aula reagendada":created.length>1?"Aulas recorrentes agendadas":"Aula agendada"}</h3><div class="sub">${esc(c.nome)} · ${diaLongo(a.date)} às ${slotTime(a.slot)} · ${esc(prof(a.prof).nome)}</div>
  ${recInfo}
  <div class="row"><span class="pill ok">${env.atrasado?"Lembrete já está na lista para enviar":`Lembrete na lista de ${env.label}`}</span></div>
  <div class="h" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface-2);white-space:pre-wrap" id="sent-txt">${esc(txt)}</div>
  <p class="note" style="margin:0">No protótipo o envio é simulado. O botão abaixo abre o WhatsApp com a mensagem pronta, para você ver como chega.</p>
  <div class="actions"><button class="btn" data-act="copy-msg">Copiar texto</button>${wa?`<a class="btn" href="${wa}" target="_blank" rel="noopener" style="text-decoration:none">Abrir no WhatsApp</a>`:""}<button class="btn primary" data-act="close">Concluir</button></div>`);
}

/* Detalhe / encerrar aula */
function openAppt(id){
  const a=appts.find(x=>x.id===id),c=cliOf(a.cid),p=prof(a.prof);
  const ms=msgs.filter(m=>m.aid===a.id&&m.status!=="cancelada");
  const aberta=a.status!=="concluida";
  const prox=a.serie?appts.filter(x=>x.serie===a.serie&&x.status!=="concluida"&&(x.date>a.date||(x.date===a.date&&x.slot>=a.slot))).length:0;
  openModal(`<h3>${esc(c.nome)}</h3><div class="sub"><span class="dot" style="background:var(${p.c})"></span> ${esc(p.nome)} · ${brDate(a.date)} · ${slotTime(a.slot)}–${slotTime(a.slot+3)} · <b>${[a.eq,...(a.extras||[])].join(" + ")}</b> ${a.status==="concluida"?'<span class="pill ok">aula encerrada</span>':""}${a.reag?' <span class="pill warn">reagendada</span>':""}</div>
  ${a.serie?`<div class="row"><span class="pill">↺ Recorrente · ${esc(recLabel(series[a.serie]))}</span><span class="note">${prox} aula${prox>1?"s":""} a partir desta</span></div>`:""}
  ${aberta?`<div class="field"><label>Aparelho agendado <span class="muted" style="font-weight:400">· toque para trocar</span></label><div class="eqs">${EQUIP.map(e=>{const f=freeOf(a.date,a.slot,e.n,a.id);return `<button class="eq" data-chg-eq="${e.n}" data-id="${a.id}" aria-pressed="${a.eq===e.n}"${f<=0&&a.eq!==e.n?" disabled":""}><b>${e.n}</b><small>${eqLabel(e,f)}</small></button>`;}).join("")}</div>
   ${a.serie&&prox>1?`<label class="row note" style="gap:6px"><input type="checkbox" id="chg-serie"> Trocar também nas próximas aulas desta série</label>`:""}</div>`:""}
  <div class="field"><label>Últimas 2 aulas</label>${histHTML(c.id,2)}</div>
  ${ms.length?`<div class="field"><label>Mensagens desta aula</label><div class="row">${ms.map(m=>`<span class="pill ${m.status==="enviada"?"ok":m.status==="agendada"?"":"warn"}">${TIPO[m.tipo]} · ${m.status} ${m.quando}</span>`).join("")}</div></div>`:""}
  <div class="actions">${aberta?`<button class="btn danger" data-act="cancel-appt" data-id="${a.id}">Desmarcar${a.serie?" esta":""}</button>${a.serie&&prox>1?`<button class="btn danger" data-act="cancel-serie" data-id="${a.id}">Desmarcar esta e as próximas</button>`:""}<button class="btn" data-act="resched" data-id="${a.id}">Reagendar</button><button class="btn primary" data-act="finish" data-id="${a.id}">Encerrar aula</button>`:""}<button class="btn" data-act="close">Fechar</button></div>`);
}
function changeEq(id,eq,serie){
  const a=appts.find(x=>x.id===id);
  const alvo=serie?appts.filter(x=>x.serie===a.serie&&x.status!=="concluida"&&(x.date>a.date||(x.date===a.date&&x.slot>=a.slot))):[a];
  let n=0,sem=[];alvo.forEach(x=>{if(x.eq===eq)return;if(freeOf(x.date,x.slot,eq,x.id)>0){x.eq=eq;n++;}else sem.push(brDate(x.date));});
  renderAgenda();openAppt(id);
  toast(sem.length?`Trocado para ${eq} em ${n} aula${n>1?"s":""}. Sem ${eq} livre em: ${sem.join(", ")}`:`Aparelho trocado para ${eq}${n>1?` em ${n} aulas`:""}`);
}

function openFinish(id,step){
  const a=appts.find(x=>x.id===id),c=cliOf(a.cid);
  if(step!=="sim"&&step!=="nao"){
    openModal(`<h3>Encerrar aula de ${esc(c.nome)}</h3><div class="sub">Aparelho agendado: <b>${a.eq}</b></div><p style="margin:0">Foi usado algum aparelho a mais nesta aula?</p>
    <div class="actions"><button class="btn" data-act="finish-step" data-id="${id}" data-step="nao">Não</button><button class="btn primary" data-act="finish-step" data-id="${id}" data-step="sim">Sim</button></div>`);return;}
  openModal(`<h3>Registro da aula</h3><div class="sub">${esc(c.nome)} · ${brDate(a.date)} · ${a.eq}</div>
  ${step==="sim"?`<div class="field"><label>Aparelhos usados a mais</label><div class="checks">${EQUIP.filter(e=>e.n!==a.eq).map(e=>`<label><input type="checkbox" name="extra" value="${e.n}"> ${e.n}</label>`).join("")}</div></div>`:""}
  <div class="field"><label for="fin-obs">Observação (opcional)</label><textarea id="fin-obs" placeholder="Ex.: evolução, dores relatadas, ajustes para a próxima aula"></textarea></div>
  <div class="actions"><button class="btn ghost" data-act="close">Voltar</button><button class="btn primary" data-act="save-finish" data-id="${id}">Salvar no histórico</button></div>`);
}

/* Cliente: novo / editar */
let clientReturn=null;
function openClient(id,ret){
  clientReturn=ret||null;
  const c=id?clients.find(x=>x.id===id):{nome:bk&&ret?bk.q:"",cpf:"",email:"",tel:"",prof:ret?bk.prof:me,obs:"",plano:"",precisaRecibo:true};
  const dup=id&&c.cpf&&cpfCount[c.cpf]>1;
  openModal(`<h3>${id?"Editar aluno":"Novo aluno"}</h3>${id?"":`<div class="sub">Na versão final, o aluno entra nas abas "Clientes - Base" e "Receita" da planilha.</div>`}
  <div class="field"><label for="c-nome">Nome</label><input type="text" id="c-nome" value="${esc(c.nome)}"></div>
  <div class="grid2"><div class="field"><label for="c-cpf">CPF</label><input type="text" id="c-cpf" inputmode="numeric" value="${esc(c.cpf)}" placeholder="000.000.000-00">${c.cpfNota?`<span class="note">Na planilha estava: "${esc(c.cpfNota)}"</span>`:""}${dup?`<span class="note" style="color:var(--bad)">Mesmo CPF de outro aluno. Confira.</span>`:""}</div>
  <div class="field"><label for="c-tel">Telefone (opcional)</label><input type="tel" id="c-tel" value="${esc(c.tel)}" placeholder="(51) 9 0000-0000"></div></div>
  <div class="grid2"><div class="field"><label for="c-email">E-mail</label><input type="email" id="c-email" value="${esc(c.email)}"></div>
  <div class="field"><label for="c-prof">Profissional responsável</label><select id="c-prof">${PROFS.filter(p=>p.id===me||p.id===c.prof).map(p=>`<option value="${p.id}"${p.id===c.prof?" selected":""}>${esc(p.nome)}</option>`).join("")}</select></div></div>
  <div class="field"><label>Plano</label><div class="planos">${PLANOS.map(p=>`<label class="plano-op"><input type="radio" name="c-plano" value="${p}"${c.plano===p?" checked":""}> ${p}</label>`).join("")}</div></div>
  <div class="field" id="c-sess-wrap">${sessSelect(c.plano,c.sessoes)}</div>
  <div class="grid2"><div class="field"><label for="c-desc-t">Desconto na contratação</label><select id="c-desc-t"><option value="pct"${!c.desc||c.desc.tipo==="pct"?" selected":""}>Porcentagem (%)</option><option value="rs"${c.desc&&c.desc.tipo==="rs"?" selected":""}>Valor (R$)</option></select></div>
  <div class="field"><label for="c-desc-v">Quanto</label><input type="number" id="c-desc-v" inputmode="decimal" min="0" step="any" value="${c.desc&&c.desc.v?c.desc.v:""}" placeholder="0"></div></div>
  <p class="note" id="c-final" style="margin:0"></p>
  ${id?(c.inativo?`<div class="pausa-box"><div><span class="pill bad">Aluno inativo</span> <span class="note">${esc(pausaTxt(c))}</span></div><button class="btn primary" data-reat="${c.id}">Reativar agora</button></div>`:`<div class="pausa-box"><div><b>Situação:</b> ativo<br><span class="note">Férias, viagem ou pausa? Inative sem perder o cadastro e reative quando voltar.</span></div><button class="btn" data-pausa="${c.id}">Inativar / pausar</button></div>`):""}
  <div class="field"><label>Precisa de recibo?</label><div class="planos"><label class="plano-op"><input type="radio" name="c-rec" value="sim"${c.precisaRecibo!==false?" checked":""}> Sim, emitir todo mês</label><label class="plano-op"><input type="radio" name="c-rec" value="nao"${c.precisaRecibo===false?" checked":""}> Não precisa</label></div></div>
  <div class="field"><label for="c-obs">Observações</label><textarea id="c-obs">${esc(c.obs)}</textarea></div>
  <p class="note" id="c-err" style="color:var(--bad);margin:0" hidden></p>
  <div class="actions"><button class="btn ghost" data-act="${ret?"back-booking":"close"}">Cancelar</button><button class="btn primary" data-act="save-client" data-id="${id||""}">${id?"Salvar alterações":"Cadastrar aluno"}</button></div>`);
  updFinal();$("#c-nome").focus();
}
function formClient(){const pl=(document.querySelector('input[name=c-plano]:checked')||{}).value||"";const dv=parseFloat(($("#c-desc-v")||{}).value);return {plano:pl,sessoes:$("#c-sess")?+$("#c-sess").value:0,desc:dv>0?{tipo:$("#c-desc-t").value,v:dv}:null};}
function updFinal(){const el=$("#c-final");if(!el)return;const c=formClient();if(!c.plano){el.textContent="";return;}const base=TABELA[sessDe(c)],fin=applyDesc(c,base);el.innerHTML=fin!==base?`Tabela R$ ${base},00 · <b style="color:var(--ink)">valor com desconto R$ ${fin},00</b> por mês`:`Valor mensal: <b style="color:var(--ink)">R$ ${base},00</b>`;}

/* ---------- Renovação de período ---------- */
const CARENCIA=7; // dias após o fim do período até inativar sozinho
const diasEntre=(a,b)=>Math.round((parseKey(a)-parseKey(b))/864e5);
function renovStatus(c){
  if(c.inativo)return {st:"inativo"};
  const sids=Object.keys(series).map(Number).filter(k=>series[k].cid===c.id);
  if(!sids.length)return null;
  const sr=series[Math.max(...sids)];
  const datas=[sr.fim||"",...appts.filter(a=>a.cid===c.id).map(a=>a.date)].filter(Boolean).sort();
  const fim=datas[datas.length-1];const hoje=key(today);if(c.reativadoEm&&fim<c.reativadoEm)return null;const d=diasEntre(fim,hoje);
  const rest=appts.filter(a=>a.cid===c.id&&a.date>=hoje&&a.status!=="concluida").length;
  if(d>7)return {st:"ok",fim,rest};
  if(d>=0)return {st:"termina",fim,rest,dias:d};
  if(-d<=CARENCIA)return {st:"terminou",fim,dias:-d};
  return {st:"auto",fim};
}
function autoInativa(){clients.forEach(c=>{const r=renovStatus(c);if(r&&r.st==="auto"){c.inativo=true;c.inativoAuto=true;c.inativoFim=r.fim;}});}
function renovItems(){return clients.filter(c=>isOwner()||c.prof===me).map(c=>({c,r:renovStatus(c)})).filter(x=>x.r&&(x.r.st==="termina"||x.r.st==="terminou"||(x.r.st==="inativo"&&x.c.inativoAuto)));}
function statusPill(c){const r=renovStatus(c);if(!r)return "";if(r.st==="inativo")return `<span class="pill bad">inativo${c.pausa?" · "+esc(c.pausa.motivo)+(c.pausa.volta?" · volta "+brDate(c.pausa.volta):""):c.inativoAuto?" · sem renovação":""}</span>`;if(r.st==="termina")return `<span class="pill warn">renovar até ${brDate(r.fim)}</span>`;if(r.st==="terminou")return `<span class="pill bad">período terminou</span>`;return "";}
function renovHTML(){
  const it=renovItems();if(!it.length)return "";
  return `<div class="card renov"><div class="bar"><h2 class="sec">Renovações</h2><span class="note">Sem renovação, o aluno é inativado ${CARENCIA} dias após a última aula e sai da previsão de receita.</span></div>
  ${it.map(({c,r})=>`<div class="payrow renrow"><div class="lem-info"><b>${esc(c.nome)}</b><span class="note">${r.st==="termina"?`Período termina em ${brDate(r.fim)}${r.rest?` · ${r.rest} aula${r.rest>1?"s":""} restante${r.rest>1?"s":""}`:""}`:r.st==="terminou"?`Terminou em ${brDate(r.fim)} · inativa em ${CARENCIA-r.dias} dia${CARENCIA-r.dias===1?"":"s"} se não renovar`:`Inativado automaticamente · período terminou em ${brDate(c.inativoFim)}`}</span><span class="row" style="gap:6px">${planoPill(c)}</span></div>
   ${r.st==="inativo"?`<button class="btn" data-reat="${c.id}">Reativar</button><button class="btn primary" data-renov="${c.id}">Renovar</button>`:`<button class="btn danger" data-inat="${c.id}">Não renovou · inativar</button><button class="btn primary" data-renov="${c.id}">Renovar</button>`}</div>`).join("")}</div>`;
}
function openRenov(cid){
  const c=clients.find(x=>x.id===cid);const sids=Object.keys(series).map(Number).filter(k=>series[k].cid===cid);const sr=sids.length?series[Math.max(...sids)]:null;
  const r=renovStatus(c)||{};const fim=r.fim||c.inativoFim||key(today);
  if(!sr){c.inativo=false;c.inativoAuto=false;openBooking(key(today),0);return;}
  openModal(`<h3>Renovar ${esc(c.nome)}</h3><div class="sub">${esc(prof(sr.prof).nome)} · ${esc(recLabel(sr))}</div>
  <div class="field"><label for="rn-w">Renovar por</label><select id="rn-w">${[4,8,12,16,24].map(n=>`<option value="${n}"${n===(sr.weeks||4)?" selected":""}>${n} semanas</option>`).join("")}</select></div>
  <p class="note" style="margin:0">As aulas continuam nos mesmos dias e horários, a partir da semana seguinte a ${brDate(fim)}, com Solo marcado (dá para trocar o aparelho em cada aula). O aluno volta a entrar na previsão de receita.</p>
  <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" data-act="renov-ok" data-id="${cid}">Renovar</button></div>`);
}
function doRenov(cid,weeks){
  const c=clients.find(x=>x.id===cid);const sids=Object.keys(series).map(Number).filter(k=>series[k].cid===cid);const sr=series[Math.max(...sids)];
  const r=renovStatus(c)||{};let base=r.fim||c.inativoFim||key(today);if(base<key(today))base=key(today);
  const mon=parseKey(base);mon.setDate(mon.getDate()-((mon.getDay()+6)%7)+7);
  const ns=sid++;series[ns]={days:sr.days.map(x=>({...x})),cid,prof:sr.prof,weeks};let n=0,last=key(mon);
  for(let w=0;w<weeks;w++)for(let i=0;i<6;i++){const dd=sr.days[i];if(!dd||!dd.on)continue;const d=new Date(mon);d.setDate(d.getDate()+w*7+i);const k=key(d);const slot=Math.min(dd.slot,maxStart(k));appts.push({id:aid++,date:k,slot,prof:sr.prof,cid,eq:"Solo",status:"agendada",serie:ns});n++;last=k;}
  series[ns].fim=last;c.inativo=false;c.inativoAuto=false;delete c.inativoFim;
  closeModal();render();toast(`${c.nome}: ${n} aulas renovadas até ${brDate(last)}`);
}
function openInativar(cid){
  const c=clients.find(x=>x.id===cid);const fut=appts.filter(a=>a.cid===cid&&a.date>=key(today)&&a.status!=="concluida").length;
  openModal(`<h3>Inativar ${esc(c.nome)}</h3><p style="margin:0">O aluno não renovou o período. Ao inativar:</p>
  <ul style="margin:0;padding-left:18px"><li>sai da previsão de receita dos próximos meses;</li>${fut?`<li>${fut} aula${fut>1?"s":""} futura${fut>1?"s":""} ${fut>1?"são desmarcadas":"é desmarcada"};</li>`:""}<li>o histórico de aulas e pagamentos continua guardado.</li></ul>
  <p class="note" style="margin:0">Dá para reativar a qualquer momento na aba Clientes, ou agendando uma aula para ele.</p>
  <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn danger" data-act="inat-ok" data-id="${cid}">Inativar</button></div>`);
}
function doInativar(cid){const c=clients.find(x=>x.id===cid);const hoje=key(today);
  appts.filter(a=>a.cid===cid&&a.date>=hoje&&a.status!=="concluida").forEach(a=>{msgs.forEach(m=>{if(m.aid===a.id&&m.status==="agendada")m.status="cancelada";});appts.splice(appts.indexOf(a),1);});
  c.inativo=true;c.inativoAuto=false;closeModal();render();toast(`${c.nome} inativado(a)`);}

/* ---------- Inativar / pausar (férias, viagem…) ---------- */
const MOTIVOS=["Férias / viagem","Saúde","Financeiro","Outro"];
function pausaTxt(c){if(!c.pausa)return c.inativoAuto?"Inativado por não renovar o período.":"Inativo.";const p=c.pausa;return `${p.motivo}${p.desde?` · desde ${brDate(p.desde)}`:""}${p.volta?` · volta prevista ${brDate(p.volta)}`:" · sem data de volta"}${p.obs?` · ${p.obs}`:""}`;}
function openPausa(cid){
  const c=clients.find(x=>x.id===cid);const hoje=key(today);
  const fut=appts.filter(a=>a.cid===cid&&a.date>=hoje&&a.status!=="concluida").length;
  openModal(`<h3>Inativar ${esc(c.nome)}</h3>
  <p style="margin:0">Use para férias, viagem ou qualquer pausa. Enquanto estiver inativo, o aluno <b>não entra na previsão de receita</b>. O cadastro, o histórico de aulas e os pagamentos continuam guardados, e dá para reativar a qualquer momento.</p>
  <div class="grid2"><div class="field"><label for="pz-mot">Motivo</label><select id="pz-mot">${MOTIVOS.map(m=>`<option>${m}</option>`).join("")}</select></div>
  <div class="field"><label for="pz-volta">Previsão de volta (opcional)</label><input type="date" id="pz-volta" min="${hoje}"></div></div>
  <div class="field"><label for="pz-obs">Observação (opcional)</label><input type="text" id="pz-obs" placeholder="Ex.: viagem de fim de ano, renova na volta"></div>
  ${fut?`<label class="row" style="gap:8px"><input type="checkbox" id="pz-desm" checked> Desmarcar as ${fut} aula${fut>1?"s":""} já agendada${fut>1?"s":""} (até a data de volta, se informada)</label>`:""}
  <p class="note" style="margin:0">Perto da data de volta, aparece um aviso na aba Clientes para reativar.</p>
  <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn danger" data-act="pausa-ok" data-id="${cid}">Inativar</button></div>`);
}
function doPausa(cid){
  const c=clients.find(x=>x.id===cid);const hoje=key(today);
  const volta=($("#pz-volta")||{}).value||"";const desm=$("#pz-desm")?$("#pz-desm").checked:false;
  let n=0;
  if(desm)appts.filter(a=>a.cid===cid&&a.date>=hoje&&a.status!=="concluida"&&(!volta||a.date<volta)).forEach(a=>{msgs.forEach(m=>{if(m.aid===a.id&&m.status==="agendada")m.status="cancelada";});appts.splice(appts.indexOf(a),1);n++;});
  c.inativo=true;c.inativoAuto=false;delete c.inativoFim;
  c.pausa={motivo:$("#pz-mot").value,desde:hoje,volta,obs:$("#pz-obs").value.trim()};
  closeModal();render();toast(`${c.nome} inativado(a)${n?` · ${n} aula${n>1?"s":""} desmarcada${n>1?"s":""}`:""}`);
}
function reativar(c){if(!c)return;c.inativo=false;c.inativoAuto=false;delete c.inativoFim;c.pausa=null;c.reativadoEm=key(today);closeModal();render();toast(`${c.nome} reativado(a). Ele volta a entrar na previsão de receita.`);}
function voltaHTML(){
  const lim=new Date(today);lim.setDate(lim.getDate()+7);const L=key(lim);
  const l=clients.filter(c=>c.inativo&&c.pausa&&c.pausa.volta&&c.pausa.volta<=L&&(isOwner()||c.prof===me)).sort((a,b)=>a.pausa.volta<b.pausa.volta?-1:1);
  if(!l.length)return "";
  return `<div class="card" style="margin-bottom:12px"><h2 class="sec" style="font-size:17px">Retorno previsto</h2><div class="team">${l.map(c=>`<div class="tm"><div><b>${esc(c.nome)}</b> <span class="pill ${c.pausa.volta<=key(today)?"warn":""}">volta ${brDate(c.pausa.volta)}</span><div class="note">${esc(c.pausa.motivo)}${c.pausa.obs?" · "+esc(c.pausa.obs):""}</div></div><div class="acts"><button class="btn primary" data-reat="${c.id}">Reativar</button></div></div>`).join("")}</div></div>`;
}

/* ---------- Clientes ---------- */
function renderClientes(){
  const q=clientFilter.trim().toLowerCase();
  let list=clients.filter(c=>clientScope==="todos"||c.prof===me);
  if(q)list=list.filter(c=>c.nome.toLowerCase().includes(q)||c.cpf.includes(q)||c.email.toLowerCase().includes(q));
  const semCpf=clients.filter(c=>!c.cpf).length;
  $("#view").innerHTML=renovHTML()+voltaHTML()+`<div class="bar"><h2 class="sec">Clientes <span class="muted" style="font-size:14px;font-family:var(--body)">${list.length} de ${clients.length}</span></h2>
  <div class="row"><input type="search" id="cl-q" placeholder="Buscar nome, CPF ou e-mail" value="${esc(clientFilter)}" style="width:240px;max-width:100%">
  <select id="cl-scope" style="width:auto"><option value="meus"${clientScope==="meus"?" selected":""}>Meus alunos</option><option value="todos"${clientScope==="todos"?" selected":""}>Todos</option></select>
  <button class="btn primary" data-act="new-client-tab">+ Novo aluno</button></div></div>
  <p class="note" style="margin:0">${clients.length-semCpf} alunos já têm CPF (copiado da aba Receita e padronizado no formato 000.000.000-00). ${semCpf} ainda sem CPF.</p>
  <div class="tbl"><table><thead><tr><th>Nome</th><th>Plano</th><th>CPF</th><th>Telefone</th><th>E-mail</th><th>Profissional</th><th></th></tr></thead><tbody>
  ${list.map(c=>{const p=prof(c.prof);const dup=c.cpf&&cpfCount[c.cpf]>1;return `<tr${c.inativo?' class="inativo"':""}><td><b>${esc(c.nome)}</b> ${statusPill(c)}${c.precisaRecibo===false?' <span class="pill">sem recibo</span>':""}</td><td>${planoPill(c)}</td><td style="font-variant-numeric:tabular-nums">${c.cpf?esc(c.cpf):`<span class="pill warn">${c.cpfNota?esc(c.cpfNota):"sem CPF"}</span>`}${dup?' <span class="pill bad">CPF repetido</span>':""}</td><td>${esc(c.tel)||'<span class="muted">—</span>'}</td><td>${esc(c.email)||'<span class="muted">—</span>'}</td><td><span class="row" style="gap:6px"><span class="dot" style="background:var(${p.c})"></span>${esc(p.nome)}</span></td><td><div class="cl-acts"><button class="btn" data-edit="${c.id}">Editar</button>${c.inativo?`<button class="btn" data-reat="${c.id}">Reativar</button>`:`<button class="btn" data-pausa="${c.id}">Inativar</button>`}</div></td></tr>`;}).join("")||`<tr><td colspan="7" class="muted">Nenhum aluno encontrado.</td></tr>`}
  </tbody></table></div>`;
}

/* ---------- Receita ---------- */
function revenue(){
  const cur=today.getMonth();
  const rows=clients.map(c=>{
    let last=null;for(let k=cur;k>=0;k--){const x=c.meses[k];if(!x)continue;const vv=x.pontual?x.base:x.v;if(vv){last={v:vv};break;}}
    const pv=c.inativo?0:planoValor(c);const sess=c.meses.map((m,i)=>m||i<cur?0:agendaSess(c.id,i));const proj=c.meses.map((m,i)=>{if(m||i<cur||c.inativo)return null;if(sess[i])return applyDesc(c,valorSess(sess[i]));if(i>cur&&pv)return pv;if(i>cur&&last)return last.v;return null;});
    return {c,proj,sess,total:c.meses.reduce((s,m)=>s+(m?m.v:0),0),last:c.inativo?0:(last?last.v:pv)};
  });
  const mon=MONTHS.map((_,i)=>{let pago=0,lanc=0,proj=0;rows.forEach(r=>{const m=r.c.meses[i];if(m){if(m.d)pago+=m.v;else lanc+=m.v;}if(r.proj[i])proj+=r.proj[i];});return{pago,lanc,proj};});
  return {rows,mon,cur};
}
let payMonth=new Date().getMonth(),payFilter="todos";
/* despesas fixas mensais (descontadas da receita para o resultado do mês) */
const despesas=[{nome:"Aluguel da sala",v:1600}];
const despTotal=()=>despesas.reduce((s,d)=>s+(+d.v||0),0);
function despHTML(){return `<div class="card desp"><div class="bar"><h2 class="sec">Despesas fixas do mês</h2><button class="btn" data-act="desp-add">+ Despesa</button></div>
  <div class="desplist">${despesas.map((d,i)=>`<div class="desprow"><input type="text" id="dn-${i}" value="${esc(d.nome)}" aria-label="Nome da despesa"><input type="number" id="dv-${i}" inputmode="decimal" min="0" step="any" value="${d.v}" aria-label="Valor mensal"><button class="btn ghost" data-act="desp-del" data-i="${i}" aria-label="Remover despesa">✕</button></div>`).join("")||'<p class="note" style="margin:0">Nenhuma despesa cadastrada.</p>'}</div>
  <div class="row" style="justify-content:space-between"><span class="note">Valem para todos os meses e são descontadas da receita no resultado.</span><b>Total: ${brl(despTotal())} por mês</b></div></div>`;}
const hojeBR=()=>{const d=new Date();return pad(d.getDate())+"/"+pad(d.getMonth()+1);};
function payItems(i,rows){return rows.map(r=>{const m=r.c.meses[i];const v=m?m.v:r.proj[i];if(!v)return null;return {r,m,v,pago:!!(m&&m.d),rec:m&&m.recibo};}).filter(Boolean);}
/* ---------- Recibos ---------- */
const MES_EXT=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
let recSeq=0;
function extenso(n){
  const u=["zero","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const d=["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const c=["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
  const ate999=x=>{if(x===100)return "cem";const p=[];const h=Math.floor(x/100),r=x%100;if(h)p.push(c[h]);if(r){if(r<20)p.push(u[r]);else{const t=Math.floor(r/10),o=r%10;p.push(o?d[t]+" e "+u[o]:d[t]);}}return p.join(" e ");};
  const reais=Math.floor(n),cent=Math.round((n-reais)*100);let txt="";
  if(reais){const mil=Math.floor(reais/1000),r=reais%1000;const p=[];if(mil)p.push(mil===1?"mil":ate999(mil)+" mil");if(r)p.push(ate999(r));txt=p.join(r&&(r<100||r%100===0)?" e ":" ")+(reais===1?" real":" reais");}
  if(cent)txt+=(txt?" e ":"")+ate999(cent)+(cent===1?" centavo":" centavos");
  return txt||"zero reais";
}
function recPend(i){return revenue().rows.filter(r=>{const m=r.c.meses[i];return r.c.precisaRecibo!==false&&m&&m.d&&!m.recibo;});}
function openRecibo(cid,i){
  const c=clients.find(x=>x.id===cid);const m=c.meses[i];
  const num=m.recibo?m.recibo.n:"(será gerado ao emitir)";
  const data=m.recibo?m.recibo.data:new Date().toLocaleDateString("pt-BR");
  const sess=sessDe(c);
  const ref=`${c.plano?`plano ${c.plano}${sess?` (${sess} ${sess>1?"sessões":"sessão"})`:""}`:"aulas de Pilates"} referente a ${MES_EXT[i]} de 2026`;
  const txt=`RECIBO Nº ${num}\n\nRecebi de ${c.nome}${c.cpf?`, CPF ${c.cpf}`:""}, a importância de ${brl(m.v).replace(/\s/g," ")} (${extenso(m.v)}), referente a ${ref}, pago em ${m.d}/2026.\n\nStudio Equilibra Pilates\n${data}\n\nCamila`;
  const logo=document.querySelector(".logo img");
  openModal(`<h3>Recibo · ${MES_EXT[i]}</h3><div class="sub">${esc(c.nome)} ${m.recibo?`<span class="pill ok">emitido em ${m.recibo.data}</span>`:'<span class="pill warn">ainda não emitido</span>'}</div>
  <div class="recibo">
    <div class="rec-top">${logo?`<img src="${logo.src}" alt="Studio Equilibra">`:"<b>Studio Equilibra Pilates</b>"}<div class="rec-n"><small>Recibo nº</small><b>${num}</b></div></div>
    <div class="rec-v">${brl(m.v)}</div>
    <p>Recebi de <b>${esc(c.nome)}</b>${c.cpf?`, CPF ${esc(c.cpf)}`:""}, a importância de <b>${brl(m.v)}</b> (${extenso(m.v)}), referente a ${esc(ref)}, pago em ${m.d}/2026.</p>
    <div class="rec-ass"><span>${data}</span><span class="rec-line">Camila · Studio Equilibra Pilates</span></div>
  </div>
  ${!c.cpf?'<p class="note" style="color:var(--warn);margin:0">Aluno sem CPF no cadastro. O recibo sai sem CPF; complete na aba Clientes se precisar.</p>':""}
  <pre id="sent-txt" hidden>${esc(txt)}</pre>
  <div class="actions"><button class="btn" data-act="copy-msg">Copiar texto</button><a class="btn" href="${waLink(c.tel,txt)}" target="_blank" rel="noopener" style="text-decoration:none" data-recwa="${cid}:${i}">Enviar no WhatsApp</a>${m.recibo?"":`<button class="btn primary" data-act="rec-emit" data-k="${cid}:${i}">Marcar como emitido</button>`}<button class="btn ghost" data-act="close">Fechar</button></div>`);
}
function emitRecibo(cid,i){const c=clients.find(x=>x.id===cid);const m=c.meses[i];if(m.recibo)return;recSeq++;m.recibo={n:`2026-${pad(i+1)}-${String(recSeq).padStart(3,"0")}`,data:new Date().toLocaleDateString("pt-BR")};}
function payHTML(rows,q){
  const all=payItems(payMonth,rows);
  const pagos=all.filter(x=>x.pago),pend=all.filter(x=>!x.pago),semRec=pagos.filter(x=>!x.rec&&x.r.c.precisaRecibo!==false);
  const soma=a=>a.reduce((s,x)=>s+x.v,0);
  let list=payFilter==="pagos"?pagos:payFilter==="pendentes"?pend:payFilter==="semrecibo"?semRec:all;
  if(q)list=list.filter(x=>x.r.c.nome.toLowerCase().includes(q));
  list=list.slice().sort((a,b)=>a.pago-b.pago||a.r.c.nome.localeCompare(b.r.c.nome));
  return `<div class="card pay"><div class="bar"><h2 class="sec">Pagamentos</h2>
   <div class="row"><select id="pay-m" style="width:auto">${MONTHS.map((m,i)=>`<option value="${i}"${i===payMonth?" selected":""}>${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][i]}</option>`).join("")}</select>
   <select id="pay-f" style="width:auto"><option value="todos"${payFilter==="todos"?" selected":""}>Todos</option><option value="pendentes"${payFilter==="pendentes"?" selected":""}>Pendentes</option><option value="pagos"${payFilter==="pagos"?" selected":""}>Pagos</option><option value="semrecibo"${payFilter==="semrecibo"?" selected":""}>Pagos sem recibo</option></select></div></div>
   <div class="row"><span class="pill ok">${pagos.length} pago${pagos.length===1?"":"s"} · ${brl(soma(pagos))}</span><span class="pill warn">${pend.length} pendente${pend.length===1?"":"s"} · ${brl(soma(pend))}</span>${semRec.length?`<span class="pill bad">${semRec.length} sem recibo</span>`:pagos.length?'<span class="pill ok">recibos em dia</span>':""}</div>
   <div class="paylist">${list.map(x=>`<div class="payrow"><div class="lem-info"><b>${esc(x.r.c.nome)}</b><span class="row" style="gap:6px">${planoPill(x.r.c)}${!x.m?`<span class="note">${x.r.sess[payMonth]?`${x.r.sess[payMonth]} ${x.r.sess[payMonth]>1?"sessões":"sessão"} na agenda`:"valor previsto"}</span>`:""}</span></div><button class="payval" data-editv="${x.r.c.id}:${payMonth}:${x.v}" title="Editar valor deste mês">${brl(x.v)} <span aria-hidden="true">✎</span>${x.m&&x.m.pontual?`<small style="display:block;font-weight:400;color:var(--muted)">só neste mês · ${esc(x.m.pontual)}</small>`:""}</button><button class="paybtn ${x.pago?"paid":"pend"}" data-pay="${x.r.c.id}:${payMonth}:${x.v}" aria-pressed="${x.pago}">${x.pago?`✓ Pago em ${x.m.d}`:"Pendente · marcar pago"}</button>${x.pago?(x.r.c.precisaRecibo===false&&!x.rec?`<button class="recbtn ok" data-rec="${x.r.c.id}:${payMonth}" title="Aluno marcado como sem necessidade de recibo. Toque para emitir mesmo assim.">Não precisa de recibo</button>`:`<button class="recbtn${x.rec?" ok":""}" data-rec="${x.r.c.id}:${payMonth}">${x.rec?`Recibo ${x.rec.n}`:"Emitir recibo"}</button>`):'<span class="recbtn off" aria-hidden="true">—</span>'}</div>`).join("")||'<p class="note" style="margin:0">Nenhum aluno nesta lista.</p>'}</div>
   <p class="note" style="margin:0">Depois de pago, use "Emitir recibo" para gerar e enviar o recibo do mês (só para alunos que precisam de recibo; isso se define no cadastro do aluno). Toque no valor (✎) para editar o valor do mês, por exemplo por desconto. Toque no botão para alternar entre pago e pendente. Ao marcar como pago, a data de hoje fica registrada. Também dá para tocar nos valores da tabela abaixo.</p></div>`;
}
function openEditValor(cid,i,v){const c=clients.find(x=>x.id===cid);
  openModal(`<h3>Valor de ${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][i]}</h3><div class="sub">${esc(c.nome)} ${planoPill(c)}</div>
  <div class="field"><label for="ev-v">Valor cobrado neste mês (R$)</label><input type="number" id="ev-v" inputmode="decimal" min="0" step="any" value="${v}"></div>
  <div class="field"><label for="ev-mot">Motivo (opcional)</label><select id="ev-mot"><option value="ajuste">Ajuste pontual</option><option value="desconto">Desconto no 1º mês</option><option value="aula a menos">Aula a menos no mês</option><option value="proporcional">Valor proporcional (entrou no meio do mês)</option></select></div>
  <p class="note" style="margin:0"><b>Vale só para este mês.</b> Os meses seguintes continuam com o valor do plano. Para um desconto fixo em todos os meses, edite o aluno na aba Clientes.</p>
  <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" data-act="save-valor" data-k="${cid}:${i}" data-base="${v}">Salvar valor</button></div>`);
  const inp=$("#ev-v");inp.focus();inp.select();}
function togglePay(cid,i,v){
  const c=clients.find(x=>x.id===cid);const m=c.meses[i];
  if(m&&m.d){m.d="";delete m.recibo;toast(`${c.nome}: ${MONTHS[i]} marcado como pendente`);}
  else{if(m)m.d=hojeBR();else c.meses[i]={d:hojeBR(),v};toast(`${c.nome}: ${MONTHS[i]} marcado como pago`);}
  renderReceita();
}
function renderReceita(){
  const {rows,mon,cur}=revenue();
  const ano=mon.reduce((s,m)=>s+m.pago+m.lanc+m.proj,0);const dt=despTotal();const liq=i=>mon[i].pago+mon[i].lanc+mon[i].proj-dt;const anoLiq=ano-dt*12;
  const pagoAno=mon.reduce((s,m)=>s+m.pago,0);
  const max=Math.max(...mon.map(m=>m.pago+m.lanc+m.proj));
  const ativos=rows.filter(r=>r.last).length;
  const q=revFilter.trim().toLowerCase();
  const list=rows.filter(r=>!q||r.c.nome.toLowerCase().includes(q));
  const rp=recPend(cur);const hoje=new Date();const fimMes=new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate()-hoje.getDate();
  $("#view").innerHTML=(rp.length?`<div class="banner rec-alert"><span><b>Recibos de ${MES_EXT[cur]}</b> · ${rp.length} aluno${rp.length>1?"s pagaram":" pagou"} e ainda não ${rp.length>1?"receberam":"recebeu"} recibo${fimMes<=5?` · faltam ${fimMes} dia${fimMes===1?"":"s"} para o fim do mês`:""}</span><button class="btn primary" data-act="ver-semrec">Ver e emitir</button></div>`:"")+`<div class="kpis">
   <div class="kpi"><small>Resultado de ${MES_EXT[cur]}</small><b>${brl(liq(cur))}</b><span>receita ${brl(mon[cur].pago+mon[cur].lanc+mon[cur].proj)} − despesas ${brl(dt)}</span></div>
   <div class="kpi"><small>Resultado previsto ${MES_EXT[Math.min(cur+1,11)]}</small><b>${brl(liq(Math.min(cur+1,11)))}</b><span>receita ${brl(mon[Math.min(cur+1,11)].pago+mon[Math.min(cur+1,11)].lanc+mon[Math.min(cur+1,11)].proj)} − despesas ${brl(dt)}</span></div>
   <div class="kpi"><small>Resultado previsto ${MES_EXT[Math.min(cur+2,11)]}</small><b>${brl(liq(Math.min(cur+2,11)))}</b><span>receita ${brl(mon[Math.min(cur+2,11)].pago+mon[Math.min(cur+2,11)].lanc+mon[Math.min(cur+2,11)].proj)} − despesas ${brl(dt)}</span></div>
   <div class="kpi"><small>Resultado 2026 (com previsão)</small><b>${brl(anoLiq)}</b><span>receita ${brl(ano)} − despesas ${brl(dt*12)}</span></div></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="bar"><h2 class="sec">Receita por mês</h2>
   <div class="keys"><span><span class="sw" style="background:var(--accent)"></span>Pago</span><span><span class="sw" style="background:var(--accent);opacity:.45"></span>Pendente</span><span><span class="sw" style="background:repeating-linear-gradient(45deg,var(--p1) 0 3px,transparent 3px 6px);border:1px solid var(--p1)"></span>Previsão</span></div></div>
   <div style="overflow-x:auto"><div style="min-width:520px"><div class="bars">${mon.map(m=>{const t=m.pago+m.lanc+m.proj;return `<div class="col" title="${brl(t)}"><div class="val">${t?(t/1000).toFixed(1).replace(".",",")+" mil":""}</div>${m.proj?`<div class="seg3" style="height:${m.proj/max*85}%"></div>`:""}${m.lanc?`<div class="seg2" style="height:${m.lanc/max*85}%;${m.proj?"":"border-radius:4px 4px 0 0"}"></div>`:""}${m.pago?`<div class="seg1" style="height:${m.pago/max*85}%;${m.lanc||m.proj?"border-radius:0":""}"></div>`:""}</div>`;}).join("")}</div>
   <div class="mlabels">${MONTHS.map((m,i)=>`<div style="${i===cur?"color:var(--ink)":""}">${m}</div>`).join("")}</div>
   <div class="mlabels liq">${MONTHS.map((m,i)=>`<div style="color:${liq(i)<0?"var(--bad)":"var(--ink)"}" title="Resultado: receita menos despesas">${(liq(i)/1000).toFixed(1).replace(".",",")}</div>`).join("")}</div></div></div>
   <p class="note" style="margin:0">Barras: receita bruta do mês (em mil). Linha de baixo: resultado do mês, receita menos ${brl(dt)} de despesas fixas (em mil).</p>
   <p class="note" style="margin:0">Valores lidos da aba "Receita". Pago = tem data de pagamento; pendente = valor lançado sem pagamento confirmado. Previsão de cada aluno, por ordem: 1) aulas marcadas na agenda naquele mês, com o preço da tabela 2026 pelo número de sessões (ex.: 5 aulas = R$ 270); 2) sem aulas na agenda, o valor do plano; 3) sem plano, o último valor pago em out (ou set).</p></div>
  ${despHTML()}
  ${payHTML(rows,q)}
  <div class="card tabela"><h2 class="sec">Valores 2026</h2>
   <div class="tabgrid">${[["Aula livre",[1,2,3]],["1x por semana",[4,5,6,7]],["2x por semana",[8,9,10,11]],["3x por semana",[12]]].map(([t,ns])=>`<div class="tabcol"><b>${t}</b>${ns.map(n=>`<div class="tabrow"><span>${n} ${n>1?"sessões":"sessão"}</span><span>R$ ${TABELA[n].toLocaleString("pt-BR")},00</span></div>`).join("")}</div>`).join("")}</div></div>
  <div class="bar"><h2 class="sec">Por aluno</h2><input type="search" id="rv-q" placeholder="Buscar aluno" value="${esc(revFilter)}" style="width:220px;max-width:100%"></div>
  <div class="tbl"><table><thead><tr><th>Aluno</th>${MONTHS.map(m=>`<th class="num">${m}</th>`).join("")}<th class="num">Total</th></tr></thead><tbody>
  ${list.map(r=>`<tr><td><b>${esc(r.c.nome)}</b></td>${r.c.meses.map((m,i)=>`<td class="num">${m?`<button class="cellpay${m.d?"":" pend"}" data-pay="${r.c.id}:${i}:${m.v}" title="${m.d?"Pago em "+m.d+" · toque para marcar pendente":"Pendente · toque para marcar pago"}">${m.v}</button>`:r.proj[i]?`<button class="cellpay proj" data-pay="${r.c.id}:${i}:${r.proj[i]}" title="${r.sess[i]?r.sess[i]+" sessões na agenda · ":""}Previsão · toque para marcar pago">${r.proj[i]}*</button>`:'<span class="muted">·</span>'}</td>`).join("")}<td class="num"><b>${brl(r.total)}</b></td></tr>`).join("")}
  <tr><td><b>Receita do mês</b></td>${mon.map(m=>`<td class="num"><b>${(m.pago+m.lanc+m.proj).toLocaleString("pt-BR")}</b></td>`).join("")}<td class="num"><b>${brl(ano)}</b></td></tr>
  <tr><td>Despesas fixas</td>${mon.map(()=>`<td class="num" style="color:var(--bad)">−${dt.toLocaleString("pt-BR")}</td>`).join("")}<td class="num" style="color:var(--bad)">−${brl(dt*12)}</td></tr>
  <tr><td><b>Resultado</b></td>${mon.map((m,i)=>`<td class="num"><b style="${liq(i)<0?"color:var(--bad)":""}">${liq(i).toLocaleString("pt-BR")}</b></td>`).join("")}<td class="num"><b>${brl(anoLiq)}</b></td></tr>
  </tbody></table></div><p class="note" style="margin:0">Laranja: pendente. * previsão. Toque num valor para marcar como pago ou pendente.</p>`;
}



/* ---------- Lembretes com um toque (WhatsApp) ---------- */
let lemDate=null;
function classDays(pid){return [...new Set(appts.filter(a=>a.prof===pid&&a.status!=="concluida"&&a.date>key(today)).map(a=>a.date))].sort();}
function lemItems(pid,date){
  return appts.filter(a=>a.prof===pid&&a.date===date&&a.status!=="concluida").sort((x,y)=>x.slot-y.slot).map(a=>{
    const m=msgs.find(x=>x.aid===a.id&&x.status!=="cancelada");const c=cliOf(a.cid);
    const kind=m?m.tipo:"vesp";const texto=m?m.texto:fill(tpl.vesp,a.date,a.slot,a.prof,a.cid,a.eq);
    return {a,c,m,kind,texto,marcado:!!m,enviado:!!(m&&m.status==="enviada")||!!a.lemEnviado};
  });
}
function lemLink(it){let d=(it.c.tel||"").replace(/\D/g,"");if(d&&!d.startsWith("55"))d="55"+d;return `https://wa.me/${d}?text=${encodeURIComponent(it.texto)}`;}
function renderBanner(){
  const el=$("#banner");const days=classDays(me);const d=days[0];
  const rp=isOwner()&&tab!=="receita"?recPend(today.getMonth()).length:0;
  const recB=rp?`<div class="banner rec-alert"><span><b>Recibos</b> · ${rp} pagamento${rp>1?"s":""} de ${MES_EXT[today.getMonth()]} sem recibo emitido</span><button class="btn primary" data-act="ver-semrec">Emitir recibos</button></div>`:"";
  const rv=tab!=="clientes"?renovItems().filter(x=>x.r.st!=="inativo").length:0;
  const renB=rv?`<div class="banner ren-alert"><span><b>Renovações</b> · ${rv} aluno${rv>1?"s":""} com o período de aulas terminando</span><button class="btn primary" data-tab="clientes">Ver renovações</button></div>`:"";
  if(!d||tab==="mensagens"){el.innerHTML=recB+renB;return;}
  const pend=lemItems(me,d).filter(i=>i.marcado&&!i.enviado).length;
  el.innerHTML=`<div class="banner"><span><b>18:00 · Lembretes</b> · ${pend?`${pend} lembrete${pend>1?"s":""} para enviar`:"Lista pronta"} das aulas de ${diaLongo(d)}</span><button class="btn primary" data-tab="mensagens">Abrir lembretes</button></div>`+recB+renB;
}
function lemHTML(){
  const days=classDays(me);
  if(!lemDate||!days.includes(lemDate))lemDate=days[0]||null;
  if(!lemDate)return `<div class="card"><h2 class="sec">Lembretes de amanhã</h2><p class="note">Nenhuma aula futura agendada para ${esc(prof(me).nome)}.</p></div>`;
  const items=lemItems(me,lemDate);const marc=items.filter(i=>i.marcado),outros=items.filter(i=>!i.marcado);
  const row=it=>`<div class="lem${it.enviado?" sent":""}">
    <div class="lem-info"><b>${slotTime(it.a.slot)} · ${esc(it.c.nome)}</b><span class="note">${TIPO[it.kind]}${it.c.tel?` · ${esc(it.c.tel)}`:" · você escolhe o contato no WhatsApp"}</span></div>
    ${it.enviado?`<span class="pill ok">Enviado</span>`:`<a class="btn wa" href="${lemLink(it)}" target="_blank" rel="noopener" data-lem="${it.a.id}">Enviar no WhatsApp</a>`}
  </div>`;
  return `<div class="card lembretes"><div class="bar"><h2 class="sec">Lembretes · ${esc(prof(me).nome)}</h2>
   <select id="lem-date" style="width:auto">${days.map(d=>`<option value="${d}"${d===lemDate?" selected":""}>Aulas de ${diaLongo(d)}</option>`).join("")}</select></div>
   <p class="note" style="margin:0">Às 18:00 de ${diaLongo(vesperaKey(lemDate))} o app avisa você. Toque em "Enviar no WhatsApp": abre o seu WhatsApp com a mensagem pronta, é só enviar.</p>
   ${marc.length?`<div class="lem-group"><div class="lem-h">Para enviar (${marc.filter(i=>!i.enviado).length})</div>${marc.map(row).join("")}</div>`:""}
   ${outros.length?`<details class="lem-group"${marc.length?"":" open"}><summary class="lem-h">Outros alunos do dia (${outros.length}), opcional</summary>${outros.map(row).join("")}</details>`:""}
  </div>`;
}

/* ---------- Mensagens ---------- */
const TPL0={...tpl}; let msgFilter="todas";
function previewTpl(k){const c=clients[0];const t=tpl[k].replace(/\{nome\}/g,c?c.nome.split(/[ /(]/)[0]:"Ana");return fill(t,key(today),8,me,null,"Reformer");}
function renderMensagens(){
  const list=msgs.filter(m=>(isOwner()||m.prof===me)&&(msgFilter==="todas"||m.status===msgFilter));
  const cls={enviada:"ok",agendada:"",cancelada:"",["sem contato"]:"warn"};
  $("#view").innerHTML=lemHTML()+`<div class="bar"><h2 class="sec">Histórico de mensagens</h2>
   <select id="ms-filtro" style="width:auto">${["todas","enviada","agendada","sem contato","cancelada"].map(f=>`<option value="${f}"${f===msgFilter?" selected":""}>${({todas:"Todas",enviada:"Enviadas",agendada:"Agendadas","sem contato":"Sem contato",cancelada:"Canceladas"})[f]}</option>`).join("")}</select></div>
  <p class="note" style="margin:0">Todo lembrete é enviado <b>às 18:00 do dia anterior à aula</b>, com um toque: o botão abre o WhatsApp do celular de quem está usando o app, com a mensagem pronta (aula de segunda: domingo às 18:00; aula de sábado: sexta às 18:00). Ele já vem marcado para <b>alunos novos</b> e <b>reagendamentos</b>; para os demais, pode ser marcado à mão. Se a aula for desmarcada ou reagendada, o lembrete antigo é cancelado sozinho. Se o agendamento for feito depois das 18:00 da véspera, o lembrete já aparece na lista para enviar.</p>
  <div class="tbl"><table><thead><tr><th>Quando</th><th>Aluno</th><th>Tipo</th><th>Envia</th><th>Situação</th><th>Mensagem</th></tr></thead><tbody>
  ${list.map(m=>{const c=cliOf(m.cid);return `<tr><td style="white-space:nowrap;font-variant-numeric:tabular-nums">${m.quando}</td><td><b>${esc(c.nome)}</b></td><td>${TIPO[m.tipo]}</td><td>WhatsApp · ${esc(prof(m.prof).nome)}</td><td><span class="pill ${cls[m.status]}">${m.status}</span></td><td style="min-width:260px;max-width:420px">${esc(m.texto)}</td></tr>`;}).join("")||`<tr><td colspan="6" class="muted" style="padding:18px 10px">Nenhuma mensagem ainda. Agende ou reagende uma aula com o lembrete marcado e ele aparece aqui.</td></tr>`}
  </tbody></table></div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="bar"><h2 class="sec">Modelos de mensagem</h2>${isOwner()?'<button class="btn" data-act="tpl-reset">Restaurar textos padrão</button>':""}</div>
   <p class="note" style="margin:0">Use {nome}, {dia}, {hora}, {profissional} e {aparelho}. O app troca pelos dados da aula. ${isOwner()?"":"Só a Camila pode alterar os modelos."}</p>
   <div class="tplgrid">${Object.keys(TIPO).map(k=>`<div class="field"><label for="tpl-${k}">${TIPO[k]}</label><textarea id="tpl-${k}" rows="4"${isOwner()?"":" disabled"}>${esc(tpl[k])}</textarea><div class="pv" id="pv-${k}">${esc(previewTpl(k))}</div></div>`).join("")}</div></div>`;
}

/* ---------- Eventos ---------- */
document.addEventListener("click",e=>{
  const lk=e.target.closest("[data-lem]");if(lk){const id=+lk.dataset.lem;const m=msgs.find(x=>x.aid===id&&x.status!=="cancelada");const ag=new Date();if(m){m.status="enviada";m.quando=`${pad(ag.getDate())}/${pad(ag.getMonth()+1)} ${pad(ag.getHours())}:${pad(ag.getMinutes())}`;}else{appts.find(x=>x.id===id).lemEnviado=true;}setTimeout(()=>{renderMensagens();toast("Marcado como enviado");},400);return;}
  const rw=e.target.closest("[data-recwa]");if(rw){const[cid,i]=rw.dataset.recwa.split(":").map(Number);emitRecibo(cid,i);setTimeout(()=>{openRecibo(cid,i);renderReceita();renderBanner();toast("Recibo enviado e marcado como emitido");},400);return;}
  const t=e.target.closest("button,[data-close-bg],.day");if(!t)return;
  if(t.dataset.who){me=t.dataset.who;render();toast(`Entrou como ${prof(me).nome}`);return;}
  if(t.dataset.tab){tab=t.dataset.tab;render();return;}
  if(t.dataset.wk){weekStart.setDate(weekStart.getDate()+7*Number(t.dataset.wk));renderAgenda();return;}
  if(t.dataset.ap){openAppt(Number(t.dataset.ap));return;}
  if(t.classList.contains("day")){const r=t.getBoundingClientRect();const rowH=r.height/SLOTS;let s=Math.floor((e.clientY-r.top)/rowH);s=Math.max(0,s);if(isSat(t.dataset.day)&&s>=SAT_END)return;openBooking(t.dataset.day,Math.min(s,maxStart(t.dataset.day)));return;}
  if(t.hasAttribute("data-close-bg")){if(e.target===t)closeModal();return;}
  if(t.dataset.pick){bk.cid=Number(t.dataset.pick);bk._focusQ=false;bk.msgTxt=null;msgDefaults();drawBooking();return;}
  if(t.dataset.eq){bk.eq=t.dataset.eq;drawBooking();return;}
  if(t.dataset.chgEq){const cb=$("#chg-serie");changeEq(Number(t.dataset.id),t.dataset.chgEq,cb&&cb.checked);return;}
  if(t.dataset.editv){const[cid,i,v]=t.dataset.editv.split(":").map(Number);openEditValor(cid,i,v);return;}
  if(t.dataset.rec){const[cid,i]=t.dataset.rec.split(":").map(Number);openRecibo(cid,i);return;}
  if(t.dataset.renov){openRenov(+t.dataset.renov);return;}
  if(t.dataset.inat){openInativar(+t.dataset.inat);return;}
  if(t.dataset.pausa){openPausa(+t.dataset.pausa);return;}
  if(t.dataset.reat){reativar(clients.find(x=>x.id===+t.dataset.reat));return;}
  if(t.dataset.pay){const[cid,i,v]=t.dataset.pay.split(":").map(Number);togglePay(cid,i,v);return;}
  if(t.dataset.edit){openClient(Number(t.dataset.edit));return;}
  const act=t.dataset.act;if(!act)return;
  if(act==="close"){closeModal();return;}
  if(act==="eq-add"){openProf(null);return;}
  if(act==="eq-edit"){openProf(t.dataset.id);return;}
  if(act==="eq-save"){saveProf(t.dataset.id||"");return;}
  if(act==="eq-del"){confirmDel(t.dataset.id);return;}
  if(act==="eq-del-ok"){teamCall("delProf",t.dataset.id,"Profissional removida. O acesso dela foi encerrado.");return;}
  if(act==="eq-revoga"){confirmRevoga(t.dataset.id);return;}
  if(act==="eq-revoga-ok"){const id=t.dataset.id;teamCall("novoLink",id,"Link revogado. Envie o novo link.",()=>openLink(prof(id),"Novo link gerado"));return;}
  if(act==="eq-copy"){copyLink(t.dataset.id);return;}
  if(act==="new-client"){openClient(null,true);return;}
  if(act==="new-client-tab"){bk=null;openClient(null,false);return;}
  if(act==="back-booking"){drawBooking();return;}
  if(act==="save-booking"){saveBooking();return;}
  if(act==="renov-ok"){doRenov(+t.dataset.id,+$("#rn-w").value);return;}
  if(act==="inat-ok"){doInativar(+t.dataset.id);return;}
  if(act==="pausa-ok"){doPausa(+t.dataset.id);return;}
  if(act==="desp-add"){despesas.push({nome:"Nova despesa",v:0});renderReceita();const i=$("#dn-"+(despesas.length-1));if(i){i.focus();i.select();}return;}
  if(act==="desp-del"){despesas.splice(+t.dataset.i,1);renderReceita();toast("Despesa removida");return;}
  if(act==="ver-semrec"){tab="receita";payMonth=today.getMonth();payFilter="semrecibo";render();return;}
  if(act==="rec-emit"){const[cid,i]=t.dataset.k.split(":").map(Number);emitRecibo(cid,i);openRecibo(cid,i);renderReceita();renderBanner();toast("Recibo emitido");return;}
  if(act==="save-valor"){const[cid,i]=t.dataset.k.split(":").map(Number);const nv=parseFloat($("#ev-v").value);if(!(nv>=0)){toast("Informe um valor válido");return;}const c=clients.find(x=>x.id===cid);const motivo=($("#ev-mot")||{}).value||"";const m0=c.meses[i];const base=m0?(m0.pontual?m0.base:m0.v):(+t.dataset.base||0);if(m0){m0.v=nv;}else c.meses[i]={d:"",v:nv};c.meses[i].pontual=motivo||"ajuste";c.meses[i].base=base||0;closeModal();renderReceita();toast(`Valor de ${c.nome} em ${MONTHS[i]}: ${brl(nv)} · só neste mês`);return;}
  if(act==="cancel-serie"){const a=appts.find(x=>x.id===Number(t.dataset.id));const rm=appts.filter(x=>x.serie===a.serie&&x.status!=="concluida"&&(x.date>a.date||(x.date===a.date&&x.slot>=a.slot)));rm.forEach(x=>{msgs.forEach(m=>{if(m.aid===x.id&&m.status==="agendada")m.status="cancelada";});appts.splice(appts.indexOf(x),1);});closeModal();renderAgenda();toast(`${rm.length} aulas desmarcadas`);return;}
  if(act==="resched"){openReschedule(Number(t.dataset.id));return;}
  if(act==="reset-msg"){bk.msgTxt=null;drawBooking();return;}
  if(act==="copy-msg"){const el=$("#sent-txt");const txt=el.textContent;const sel=()=>{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);};try{navigator.clipboard.writeText(txt).then(()=>toast("Texto copiado"),()=>{sel();toast("Texto selecionado. Use Ctrl+C para copiar");});}catch(_){sel();toast("Texto selecionado. Use Ctrl+C para copiar");}return;}
  if(act==="tpl-reset"){Object.assign(tpl,TPL0);renderMensagens();toast("Modelos restaurados");return;}
  if(act==="finish"){openFinish(Number(t.dataset.id));return;}
  if(act==="finish-step"){openFinish(Number(t.dataset.id),t.dataset.step);return;}
  if(act==="save-finish"){const a=appts.find(x=>x.id===Number(t.dataset.id));const extras=[...document.querySelectorAll('input[name=extra]:checked')].map(i=>i.value);(hist[a.cid]=hist[a.cid]||[]).push({date:a.date,prof:a.prof,eq:a.eq,extras,obs:$("#fin-obs").value.trim()});a.extras=extras;a.status="concluida";closeModal();renderAgenda();toast("Aula registrada no histórico do aluno");return;}
  if(act==="cancel-appt"){const i=appts.findIndex(x=>x.id===Number(t.dataset.id));msgs.forEach(m=>{if(m.aid===appts[i].id&&m.status==="agendada")m.status="cancelada";});appts.splice(i,1);closeModal();renderAgenda();toast("Agendamento desmarcado");return;}
  if(act==="save-client"){
    const nome=$("#c-nome").value.trim();const err=$("#c-err");
    if(!nome){err.textContent="Informe o nome do aluno.";err.hidden=false;return;}
    const d=$("#c-cpf").value.replace(/\D/g,"");
    if(d&&d.length!==11){err.textContent="O CPF precisa ter 11 números.";err.hidden=false;return;}
    const data={nome,cpf:d?fmtCPF(d):"",tel:$("#c-tel").value.trim(),email:$("#c-email").value.trim(),prof:$("#c-prof").value,obs:$("#c-obs").value.trim(),...formClient(),precisaRecibo:(document.querySelector('input[name=c-rec]:checked')||{}).value!=="nao"};
    const id=Number(t.dataset.id);
    if(id){const c=clients.find(x=>x.id===id);if(c.cpf)cpfCount[c.cpf]--;Object.assign(c,data,{cpfNota:data.cpf?"":c.cpfNota});if(c.cpf)cpfCount[c.cpf]=(cpfCount[c.cpf]||0)+1;closeModal();render();toast("Dados do aluno atualizados");return;}
    const c={id:nid++,...data,cpfNota:"",meses:Array(12).fill(null)};clients.push(c);if(c.cpf)cpfCount[c.cpf]=(cpfCount[c.cpf]||0)+1;
    if(clientReturn&&bk){bk.cid=c.id;bk.q="";bk.scope="todos";bk.msgTxt=null;msgDefaults();drawBooking();}else{closeModal();render();}
    toast(`${nome} cadastrado(a) · entraria em "Clientes - Base" e "Receita"`);return;}
});
document.addEventListener("input",e=>{
  if(e.target.id==="bk-q"){bk.q=e.target.value;bk._focusQ=true;drawBooking();}
  if(e.target.id==="bk-msgtxt"){bk.msgTxt=e.target.value;}
  if(e.target.id==="c-desc-v")updFinal();
  if(e.target.id&&e.target.id.startsWith("tpl-")){tpl[e.target.id.slice(4)]=e.target.value;const p=document.getElementById("pv-"+e.target.id.slice(4));if(p)p.textContent=previewTpl(e.target.id.slice(4));}
  if(e.target.id==="cl-q"){clientFilter=e.target.value;renderClientes();const i=$("#cl-q");i.focus();i.setSelectionRange(i.value.length,i.value.length);}
  if(e.target.id==="rv-q"){revFilter=e.target.value;renderReceita();const i=$("#rv-q");i.focus();i.setSelectionRange(i.value.length,i.value.length);}
});
document.addEventListener("change",e=>{
  if(e.target.id==="bk-time"){bk.slot=Number(e.target.value);if(bk.rec&&bk.rec.days[dIdx(bk.date)]&&bk.rec.days[dIdx(bk.date)].on)bk.rec.days[dIdx(bk.date)].slot=bk.slot;if(bk.eq&&freeOf(bk.date,bk.slot,bk.eq,bk.reschedId)<=0)bk.eq=null;drawBooking();}
  if(e.target.id==="bk-date"&&e.target.value){bk.date=e.target.value;if(bk.eq&&freeOf(bk.date,bk.slot,bk.eq,bk.reschedId)<=0)bk.eq=null;drawBooking();}
  if(e.target.id==="bk-msg"){bk.msgOn=e.target.checked;bk.msgTouched=true;drawBooking();}
  if(e.target.id==="bk-canal"){bk.canal=e.target.value;drawBooking();}
  if(e.target.id==="rec-on"){bk.rec.on=e.target.checked;if(bk.rec.on){bk.rec.days.forEach(x=>x.on=false);bk.rec.days[dIdx(bk.date)]={on:true,slot:bk.slot};}drawBooking();}
  if(e.target.classList.contains("rec-d")){const i=+e.target.dataset.i;bk.rec.days[i].on=e.target.checked;if(e.target.checked)bk.rec.days[i].slot=Math.min(bk.slot,(i===5?SAT_END:SLOTS)-3);drawBooking();}
  if(e.target.classList.contains("rec-t")){bk.rec.days[+e.target.dataset.i].slot=+e.target.value;drawBooking();}
  if(e.target.id==="rec-w"){bk.rec.weeks=+e.target.value;drawBooking();}

  
  if(e.target.id==="lem-date"){lemDate=e.target.value;renderMensagens();}
  if(e.target.name==="c-plano"){$("#c-sess-wrap").innerHTML=sessSelect(e.target.value,0);updFinal();}
  if(e.target.id==="c-sess"||e.target.id==="c-desc-t")updFinal();
  if(e.target.id&&/^d[nv]-\d+$/.test(e.target.id)){const i=+e.target.id.split("-")[1];if(e.target.id[1]==="n")despesas[i].nome=e.target.value.trim()||"Despesa";else despesas[i].v=parseFloat(e.target.value)||0;renderReceita();}
  if(e.target.id==="pay-m"){payMonth=+e.target.value;renderReceita();}
  if(e.target.id==="pay-f"){payFilter=e.target.value;renderReceita();}
  if(e.target.id==="ms-filtro"){msgFilter=e.target.value;renderMensagens();}
  if(e.target.id==="bk-prof"){bk.prof=e.target.value;drawBooking();}
  if(e.target.name==="bk-scope"){bk.scope=e.target.value;drawBooking();}
  if(e.target.id==="cl-scope"){clientScope=e.target.value;renderClientes();}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
/* contorno do horário ao passar o mouse */
document.addEventListener("mousemove",e=>{
  const d=e.target.closest&&e.target.closest(".day");document.querySelectorAll(".hover-slot").forEach(x=>{if(!d||x.parentNode!==d)x.remove();});
  if(!d||e.target.closest(".ap")||e.target.closest(".closed")){document.querySelectorAll(".hover-slot").forEach(x=>x.remove());return;}const r=d.getBoundingClientRect();let s=Math.min(maxStart(d.dataset.day),Math.max(0,Math.floor((e.clientY-r.top)/(r.height/SLOTS))));
  let hs=d.querySelector(".hover-slot");if(!hs){hs=document.createElement("div");hs.className="hover-slot";d.appendChild(hs);}
  hs.style.top=`calc(var(--row)*${s})`;hs.textContent=slotTime(s);
});

/* ---------- Equipe (só administradora) ---------- */
function setEquipe(list){PROFS.length=0;list.forEach(m=>{const k=m.cor||1;PROFS.push({id:m.id,nome:m.nome,email:m.conta||"",c:"--p"+k,cs:"--p"+k+"-soft",owner:!!m.admin,tel:"",cor:k,ativos:m.ativos||0,link:m.link||"",conta:m.conta||"",desde:m.desde||"",ultimo:m.ultimo||""});});}
function setOcup(list){ocup.length=0;(list||[]).forEach((o,i)=>ocup.push({id:-(i+1),date:o.date,slot:o.slot,eq:o.eq,prof:o.prof,ocup:true}));}
function refreshOcup(){if(!booted)return;try{google.script.run.withSuccessHandler(r=>{setOcup(JSON.parse(r));if($("#bk-prof"))drawBooking();else if(tab==="agenda"&&!$("#modal-root").innerHTML)renderAgenda();}).ocupAtual(TOKEN);}catch(e){}}
setInterval(()=>{if(document.visibilityState==="visible"&&tab==="agenda"&&!$("#modal-root").innerHTML)refreshOcup();},120000);
function convite(p){return `Olá, ${p.nome}! Este é o seu acesso pessoal ao app do Studio Equilibra Pilates:\n${p.link}\n\nAbra no celular e entre com a sua conta Google. No primeiro acesso o Google pede uma autorização (toque em Avançado → Acessar → Permitir) e o app cria automaticamente a sua planilha particular no seu Google Drive.\n\nO link fica vinculado à primeira conta Google que o usar e não funciona em outra conta. Não compartilhe.`;}
function renderEquipe(){
  const how=`<div class="how"><b>Como liberar o acesso de uma colega</b><ol>
   <li>Toque em “+ Adicionar profissional”, informe o nome e a cor da agenda.</li>
   <li>Envie o link pessoal para ela pelo botão WhatsApp.</li>
   <li>Ela abre o link e entra com a conta Google dela. O link passa a valer só para essa conta; se outra pessoa tentar usar, o acesso é recusado.</li>
   <li>No primeiro acesso, o app cria sozinho uma planilha particular no Google Drive dela, onde ficam os alunos, a agenda, o histórico e as mensagens dela.</li></ol></div>`;
  const priv=`<p class="note">Privacidade: cada profissional vê somente os próprios alunos, agenda, histórico e mensagens, guardados na planilha particular dela, que não é compartilhada com ninguém. Você vê aqui apenas o acesso de cada uma (conta vinculada, último acesso) e o número de alunos ativos. A agenda do estúdio e dos aparelhos é comum: os horários das colegas aparecem como “Ocupado”, com o aparelho, sem nome de aluno. Cada profissional mantém a própria agenda, com o limite de ${MAX_PROF} alunos por horário e o limite de cada aparelho. Só você cria, revoga ou remove acessos.</p>`;
  const st=p=>p.owner?'<span class="pill ok">Administradora</span>':p.conta?'<span class="pill ok">Acesso ativo</span>':'<span class="pill wait">Aguardando 1º acesso</span>';
  const info=p=>p.owner?`${esc(p.conta)} · entra pelo próprio e-mail`:p.conta?`Conta vinculada: ${esc(p.conta)}${p.desde?` · desde ${esc(p.desde)}`:""}${p.ultimo?` · último acesso ${esc(p.ultimo)}`:""}`:"Link ainda não usado";
  const rows=PROFS.map(p=>`<div class="tm"><div><span class="dot" style="background:var(${p.c})"></span> <b>${esc(p.nome)}</b> ${st(p)}<div class="note">${info(p)} · ${p.ativos||0} aluno${p.ativos===1?"":"s"} ativo${p.ativos===1?"":"s"}</div></div>${p.owner?"":`<div class="acts"><button class="btn" data-act="eq-copy" data-id="${p.id}">Copiar link</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(convite(p))}">Enviar no WhatsApp</a><button class="btn" data-act="eq-edit" data-id="${p.id}">Editar</button><button class="btn" data-act="eq-revoga" data-id="${p.id}">Revogar link</button><button class="btn" data-act="eq-del" data-id="${p.id}">Remover</button></div>`}</div>`).join("");
  $("#view").innerHTML=`<div class="card"><div class="bar"><h2 class="sec">Equipe e acessos</h2><button class="btn primary" data-act="eq-add">+ Adicionar profissional</button></div>${how}<div class="team">${rows}</div>${priv}</div>`;
}
function openProf(id){const p=id?prof(id):{nome:"",cor:0};
  const usadas=PROFS.filter(x=>x.id!==id).map(x=>x.cor);const cor=p.cor||[2,3,4,5,6,7,8].find(n=>!usadas.includes(n))||2;
  openModal(`<h3>${id?"Editar profissional":"Adicionar profissional"}</h3>
  <div class="field"><label for="pf-nome">Nome</label><input id="pf-nome" type="text" value="${esc(p.nome)}" autocomplete="off"></div>
  <div class="field"><label>Cor na agenda</label><div class="cores">${[2,3,4,5,6,7,8].map(n=>`<label><input type="radio" name="pf-cor" value="${n}"${n===cor?" checked":""}><span class="dot" style="background:var(--p${n})"></span></label>`).join("")}</div></div>
  ${id?"":`<p class="note" style="margin:0">Depois de adicionar, envie o link pessoal para ela. A conta Google e a planilha particular dela são vinculadas automaticamente no primeiro acesso.</p>`}
  <p class="note" id="pf-err" style="color:var(--bad);margin:0"></p>
  <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" data-act="eq-save" data-id="${id||""}">${id?"Salvar":"Adicionar"}</button></div>`);}
function saveProf(id){
  const d={id,nome:$("#pf-nome").value.trim(),cor:+((document.querySelector('input[name=pf-cor]:checked')||{}).value||2)};
  const err=$("#pf-err");if(!d.nome){err.textContent="Informe o nome.";return;}
  err.style.color="var(--muted)";err.textContent="Salvando…";
  google.script.run.withSuccessHandler(r=>{setEquipe(JSON.parse(r));if(id){closeModal();render();toast("Dados atualizados");return;}const novo=PROFS.find(x=>x.nome===d.nome);render();if(novo)openLink(novo,"Profissional adicionada");})
   .withFailureHandler(e=>{err.style.color="var(--bad)";err.textContent=(e&&e.message)||String(e);})[id?"updProf":"addProf"](JSON.stringify(d),TOKEN);}
function openLink(p,titulo){openModal(`<h3>${esc(titulo||("Link de "+p.nome))}</h3><p>Envie este link só para ${esc(p.nome)}. Ele fica vinculado à primeira conta Google que o usar.</p><input class="linkbox" type="text" readonly value="${esc(p.link)}" onclick="this.select()"><div class="actions"><button class="btn ghost" data-act="close">Fechar</button><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(convite(p))}">Enviar no WhatsApp</a></div>`);}
function confirmRevoga(id){const p=prof(id);openModal(`<h3>Revogar o link de ${esc(p.nome)}?</h3><p>O link atual para de funcionar na hora${p.conta?` e a conta ${esc(p.conta)} perde o acesso`:""}. Um novo link é gerado para você enviar; ele será vinculado à próxima conta Google que o usar.</p><p class="note">Se ela entrar de novo com a mesma conta, volta a ver a planilha dela normalmente.</p><div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" data-act="eq-revoga-ok" data-id="${p.id}">Revogar e gerar novo link</button></div>`);}
function confirmDel(id){const p=prof(id);openModal(`<h3>Remover ${esc(p.nome)}?</h3><p>O acesso dela é encerrado na hora e os horários dela saem da agenda comum do estúdio. A planilha particular dela continua no Google Drive dela.</p><div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" data-act="eq-del-ok" data-id="${p.id}">Remover</button></div>`);}
function teamCall(fn,id,msg,depois){setSync("Atualizando a equipe…");google.script.run.withSuccessHandler(r=>{setEquipe(JSON.parse(r));closeModal();render();setSync("Equipe atualizada");toast(msg);if(depois)depois();}).withFailureHandler(e=>{setSync((e&&e.message)||String(e),true);})[fn](id,TOKEN);}
function copyLink(id){const p=prof(id);try{navigator.clipboard.writeText(p.link).then(()=>toast("Link copiado"),()=>openLink(p));}catch(e){openLink(p);}}
/* ---------- Dados: planilha + armazenamento interno ---------- */
const syncEl=()=>$("#sync");
function setSync(t,bad){const e=syncEl();if(e){e.textContent=t;e.classList.toggle("bad",!!bad);}}
const PROF_BY_NAME=n=>{const p=PROFS.find(p=>p.nome.toLowerCase()===String(n||"").trim().toLowerCase());return p?p.id:"carol";};
let lastSheet={},lastPay={},lastState="",booted=false,saving=false,again=false,timer=null;
function sheetFields(c){return JSON.stringify([c.nome,c.cpf,c.email,c.tel,c.plano,c.plano?sessDe(c):0,prof(c.prof).nome,c.precisaRecibo!==false,!!c.inativo]);}
function boot(raw){
  const data=JSON.parse(raw);
  ADMIN=!!data.admin;DONO=data.dono||"";setEquipe(data.equipe||[]);me=data.me||me;
  setOcup(data.ocup);MYEMAIL=data.email||"";
  if(data.hoje){today=parseKey(data.hoje);weekStart=mondayOf(today);payMonth=today.getMonth();}
  let st={};try{st=data.state?JSON.parse(data.state):{};}catch(e){st={};}
  const ex=st.extras||{};nid=1;Object.values(ex).forEach(e=>{if(e.uid>=nid)nid=e.uid+1;});
  clients.length=0;
  const occ={};
  data.clients.forEach(sc=>{
    occ[sc.nome]=(occ[sc.nome]||0)+1;const xk=occ[sc.nome]>1?sc.nome+"#"+occ[sc.nome]:sc.nome;
    const e=ex[xk]||(occ[sc.nome]>1?ex[sc.nome]:null)||{};const r=sc.rec;
    const cpfRaw=sc.cpf||(r&&r.cpf)||"";
    const c={id:e.uid||nid++,nome:sc.nome,cpf:normCPF(cpfRaw),cpfNota:/[a-zà-ú]/i.test(cpfRaw)?cpfRaw:"",email:sc.email||"",tel:sc.tel||"",
      plano:PLANOS.includes(sc.plano)?sc.plano:"",sessoes:sc.sessoes||0,prof:me,obs:e.obs||"",
      precisaRecibo:sc.recibo?sc.recibo!=="Não":(e.precisaRecibo!==false),inativo:sc.situacao?sc.situacao==="Inativo":!!e.inativo,
      inativoAuto:!!e.inativoAuto,inativoFim:e.inativoFim,pausa:e.pausa||null,reativadoEm:e.reativadoEm||null,desc:e.desc||null,rowC:sc.rowC,rowR:r?r.row:null,
      meses:r?r.meses:Array(12).fill(null)};
    if(e.recibos)Object.keys(e.recibos).forEach(i=>{if(c.meses[i])c.meses[i].recibo=e.recibos[i];});
    if(e.pontual)Object.keys(e.pontual).forEach(i=>{const q=e.pontual[i];if(c.meses[i]){c.meses[i].pontual=q.mot||q;c.meses[i].base=q.base||0;}});
    clients.push(c);
  });
  Object.keys(cpfCount).forEach(k=>delete cpfCount[k]);clients.forEach(c=>{if(c.cpf)cpfCount[c.cpf]=(cpfCount[c.cpf]||0)+1;});
  appts.length=0;(st.appts||[]).forEach(a=>appts.push(a));
  Object.keys(hist).forEach(k=>delete hist[k]);Object.assign(hist,st.hist||{});
  msgs.length=0;(st.msgs||[]).forEach(m=>msgs.push(m));
  Object.keys(series).forEach(k=>delete series[k]);Object.assign(series,st.series||{});
  if(st.despesas){despesas.length=0;st.despesas.forEach(d=>despesas.push(d));}
  if(st.tpl)Object.assign(tpl,st.tpl);
  if(!ADMIN&&data.tpl){try{Object.assign(tpl,JSON.parse(data.tpl));}catch(e){}}
  lastTpl=JSON.stringify(tpl);
  (function(){const usados=new Set(clients.map(c=>c.id));const ref=new Set();appts.forEach(a=>ref.add(a.cid));Object.keys(hist).forEach(k=>ref.add(+k));Object.values(series).forEach(x=>ref.add(x.cid));
    const orf=[...ref].filter(x=>x&&!usados.has(x)).sort((a,b)=>a-b);const g={};clients.forEach(c=>{(g[c.id]=g[c.id]||[]).push(c);});
    Object.values(g).filter(l=>l.length>1).forEach(l=>l.slice(0,-1).forEach(c=>{c.id=orf.length?orf.shift():nid++;}));
    clients.forEach(c=>{if(c.id>=nid)nid=c.id+1;});})();
  aid=st.aid||1;mid=st.mid||1;sid=st.sid||1;recSeq=st.recSeq||0;
  aid=Math.max(aid,1+Math.max(0,...appts.map(a=>a.id)));mid=Math.max(mid,1+Math.max(0,...msgs.map(m=>m.id)));sid=Math.max(sid,1+Math.max(0,...Object.keys(series).map(Number)));
  clients.forEach(c=>{lastSheet[c.id]=sheetFields(c);c.meses.forEach((m,i)=>{lastPay[c.id+":"+i]=m?JSON.stringify([m.d,m.v]):"";});});
  lastState=JSON.stringify(stateObj());booted=true;
  setSync(`Sincronizado com ${ADMIN?"a planilha do estúdio":"a sua planilha"} · ${clients.length} aluno${clients.length===1?"":"s"}`);
  render();setTimeout(persist,1500);
}
function stateObj(){
  const extras={};const occ={};clients.forEach(c=>{occ[c.nome]=(occ[c.nome]||0)+1;const xk=occ[c.nome]>1?c.nome+"#"+occ[c.nome]:c.nome;const rec={},pon={};c.meses.forEach((m,i)=>{if(m&&m.recibo)rec[i]=m.recibo;if(m&&m.pontual)pon[i]={mot:m.pontual,base:m.base||0};});extras[xk]={uid:c.id,obs:c.obs,desc:c.desc,inativoAuto:!!c.inativoAuto,inativoFim:c.inativoFim||null,recibos:rec,pontual:pon,prof:c.prof,precisaRecibo:c.precisaRecibo!==false,inativo:!!c.inativo,pausa:c.pausa||null,reativadoEm:c.reativadoEm||null};});
  return {v:1,appts,hist,msgs,series,despesas,tpl,recSeq,aid,mid,sid,extras};
}
function ocupStr(){const h=key(today);return JSON.stringify({l:appts.filter(a=>a.date>=h).map(a=>[a.date,a.slot,a.eq]),n:clients.filter(c=>!c.inativo).length});}
function persist(){
  if(!booted)return;if(saving){again=true;return;}
  const clientes=[],pagamentos=[];
  clients.forEach(c=>{const f=sheetFields(c);if(f!==lastSheet[c.id]||!c.rowC||(ADMIN&&!c.rowR))clientes.push({key:c.id,rowC:c.rowC,rowR:c.rowR,nome:c.nome,cpf:c.cpf,email:c.email,tel:c.tel,plano:c.plano,sessoes:c.plano?sessDe(c):0,profNome:prof(c.prof).nome,precisaRecibo:c.precisaRecibo!==false,inativo:!!c.inativo});
    if(ADMIN&&c.rowR)c.meses.forEach((m,i)=>{const k=c.id+":"+i,v=m?JSON.stringify([m.d,m.v]):"";if(v!==lastPay[k])pagamentos.push({key:k,rowR:c.rowR,i,d:m?m.d:"",v:m?m.v:null});});});
  const stj=JSON.stringify(stateObj());const stChanged=stj!==lastState;
  const oc=ocupStr(),ocChanged=oc!==lastOcup,tj=JSON.stringify(tpl),tplChanged=ADMIN&&tj!==lastTpl;
  if(!clientes.length&&!pagamentos.length&&!stChanged&&!ocChanged&&!tplChanged)return;
  saving=true;setSync("Salvando na planilha…");
  google.script.run.withSuccessHandler(res=>{
    const r=JSON.parse(res);
    clientes.forEach(x=>{const c=clients.find(c=>c.id===x.key);if(!c)return;const n=r.novos[x.key];if(n){c.rowC=n.rowC;c.rowR=n.rowR;}lastSheet[c.id]=sheetFields(c);});
    pagamentos.forEach(p=>{const[cid,i]=p.key.split(":").map(Number);const c=clients.find(c=>c.id===cid);const m=c&&c.meses[i];lastPay[p.key]=m?JSON.stringify([m.d,m.v]):"";});
    if(r.ocup){setOcup(r.ocup);if(tab==="agenda"&&!$("#modal-root").innerHTML)renderAgenda();}
    lastState=stj;lastOcup=oc;if(tplChanged)lastTpl=tj;saving=false;
    const h=new Date();setSync(`Salvo na planilha às ${pad(h.getHours())}:${pad(h.getMinutes())}`);
    if(again){again=false;persist();}else if(clients.some(c=>!c.rowC||(ADMIN&&!c.rowR)))setTimeout(persist,500);
  }).withFailureHandler(err=>{saving=false;setSync("Não foi possível salvar agora. Vou tentar de novo em instantes.",true);setTimeout(persist,8000);})
  .sync(JSON.stringify({clientes,pagamentos,state:stChanged?stj:null,ocup:ocChanged?JSON.parse(oc):null,tpl:tplChanged?tj:null}),TOKEN);
}
const agendar=()=>{clearTimeout(timer);timer=setTimeout(persist,1200);};
["click","change"].forEach(ev=>document.addEventListener(ev,agendar));
window.addEventListener("beforeunload",()=>{if(booted)persist();});
setSync("Carregando dados da planilha…");
const iniciar=()=>google.script.run.withSuccessHandler(boot).withFailureHandler(e=>setSync("Não foi possível abrir: "+(e&&e.message?e.message:e),true)).loadAll(TOKEN);
try{google.script.url.getLocation(l=>{TOKEN=(l&&l.parameter&&l.parameter.k)||"";iniciar();});}catch(e){iniciar();}
})();
