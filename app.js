
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.87.3/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
});
const state = {
  user:null, member:null, admin:false, allowed:false, loading:true, busy:false,
  page:'home', adminTab:'players', modal:null, authMode:'login',
  players:[], rounds:[], roundPlayers:[], performances:[], members:[],
  globalRanking:[], ranking:[], stats:{players:0,rounds:0,votes:0,goals:0},
  scope:'global', year:new Date().getFullYear(), roundId:null,
  selectedVoteRound:null, hasVoted:false, scores:{}, mvp:null
};
const root = document.getElementById('app');
const byId = id => document.getElementById(id);
const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);
const ico = (name,cls='') => '<svg class="ico '+cls+'" aria-hidden="true"><use href="#i-'+e(name)+'"></use></svg>';
const initials = name => String(name||'?').trim().split(' ').slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const avatar = (name,index=0) => '<span class="avatar avatar-'+['a','b','c','d'][Math.abs(index)%4]+'">'+e(initials(name))+'</span>';
const dated = date => date ? new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')) : 'Sin fecha';
const day = date => String(date||'').slice(8,10);
const month = date => new Intl.DateTimeFormat('es-CL',{month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')).replace('.','');
const num = x => Number(x||0).toLocaleString('es-CL');
const fmt = x => Number(x||0).toLocaleString('es-CL',{maximumFractionDigits:2});
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const player = id => state.players.find(x=>x.id===id);
const round = id => state.rounds.find(x=>x.id===id);
const openRound = () => state.rounds.find(r=>r.is_open);
const participants = id => state.roundPlayers.filter(p=>p.round_id===id).map(x=>player(x.player_id)).filter(Boolean);
const statsFor = id => state.globalRanking.find(x=>x.player_id===id) || {points:0,average_score:0,ratings_count:0,mvp_votes:0,rounds_played:0,goals:0,assists:0};
const badge = (text,kind='') => '<span class="badge '+kind+'">'+e(text)+'</span>';
const navItems = [
  {id:'home',label:'Inicio',icon:'grid'},
  {id:'ranking',label:'Clasificación',icon:'trophy'},
  {id:'rounds',label:'Jornadas',icon:'calendar'},
  {id:'players',label:'Jugadores',icon:'users'},
  {id:'vote',label:'Votar',icon:'vote'},
  {id:'admin',label:'Administrar',icon:'settings',admin:true}
];
const empt = (title,message,icon='info',action='') =>
  '<div class="empty"><div class="empty-icon">'+ico(icon)+'</div><h3>'+e(title)+'</h3><p>'+e(message)+'</p>'+action+'</div>';
const playerRow = (p,index) => '<div class="player-inline">'+avatar(p.player_name||p.name,index)+'<div><strong>'+e(p.player_name||p.name)+'</strong><span>'+e(p.player_position||p.position||'Jugador')+' '+(p.shirt_number!=null?'· #'+e(p.shirt_number):'')+'</span></div></div>';
const actionBtn = (action,text,kind='secondary',data='') => '<button type="button" class="btn '+kind+' sm" data-action="'+action+'" '+data+'>'+text+'</button>';
let toastTimer, bootSeq=0;

function toast(message,error=false) {
  const box = byId('toast-root');
  box.innerHTML = '<div class="toast '+(error?'error':'')+'">'+ico(error?'info':'check')+'<div>'+e(message)+'</div></div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{box.innerHTML=''},5000);
}
function failure(err) {
  console.error('[CanchaRank]',err);
  const msg = err && (err.message||err.error_description) || 'Ocurrió un error inesperado';
  toast(msg,true);
}
function check(result) {
  if (result.error) throw result.error;
  return result.data;
}
function loadingHTML() {
  return '<div class="loading-state"><div class="loading-spinner"></div><p>Preparando la cancha...</p></div>';
}
function pageTitle(title,subtitle,extra='') {
  return '<div class="page-head"><div><span class="eyebrow">CANCHARANK / TEMPORADA '+new Date().getFullYear()+'</span><h1>'+e(title)+'</h1><p>'+e(subtitle)+'</p></div>'+extra+'</div>';
}
function sidebar() {
  if (!state.allowed) return '';
  const userName = state.member?.display_name||state.user?.email?.split('@')[0]||'Mi cuenta';
  const links = navItems.filter(x=>!x.admin||state.admin).map(x=>
    '<button type="button" class="nav-link '+(state.page===x.id?'active':'')+'" data-action="nav" data-page="'+x.id+'">'+ico(x.icon)+e(x.label)+'</button>'
  ).join('');
  return '<div class="logo"><span class="brand-mark">'+ico('goal')+'</span>CANCHA<b>RANK</b></div>'+
    '<div class="brand-sub">THE GAME NEVER ENDS</div>'+
    '<div class="nav-caption">TU COMPETICIÓN</div><nav class="side-nav">'+links+'</nav>'+
    '<div class="sidebar-bottom"><div class="side-promo"><span class="caps lime">'+ico('spark','sm')+' FÚTBOL REAL</span><strong>Cada voto deja huella.</strong><p>Un equipo. Una historia que crece jornada a jornada.</p></div>'+
    '<div class="account-chip">'+avatar(userName)+'<div style="flex:1;min-width:0"><strong>'+e(userName)+'</strong><span>'+(state.admin?'Administrador':'Miembro')+'</span></div>'+
    '<button class="icon-btn" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">'+ico('logout')+'</button></div></div>';
}
function topbar() {
  const name = state.member?.display_name || state.user?.email?.split('@')[0] || 'Tu cuenta';
  if (!state.allowed) return '<div class="logo"><span class="brand-mark">'+ico('goal')+'</span>CANCHA<b>RANK</b></div>'+
    '<div class="top-actions">'+(state.user?
      '<button class="btn ghost sm" data-action="logout">Salir '+ico('logout','sm')+'</button>':
      '<button class="btn ghost sm" data-action="open-auth" data-mode="login">Ingresar</button><button class="btn sm" data-action="open-auth" data-mode="register">Unirme '+ico('arrow','sm')+'</button>')+'</div>';
  const live = openRound();
  return '<div class="top-title"><span class="top-kicker">TU LIGA PRIVADA</span>'+e(navItems.find(x=>x.id===state.page)?.label||'CanchaRank')+'</div>'+
    '<div class="top-actions">'+(live?'<span class="live-pill"><span class="dot pulse"></span>VOTACIÓN ABIERTA</span>':'<span class="live-pill" style="background:#15232a;color:var(--muted);border-color:var(--line)">TEMPORADA '+new Date().getFullYear()+'</span>')+
    '<button class="icon-btn" data-action="refresh" aria-label="Actualizar datos">'+ico('refresh')+'</button>'+
    '<button class="top-user" data-action="logout" title="Cerrar sesión">'+avatar(name)+'<span>'+e(name)+'</span>'+ico('logout','sm')+'</button></div>';
}
function mobileNav() {
  if (!state.allowed) return '';
  const tabs = state.admin?['home','ranking','rounds','vote','admin']:['home','ranking','rounds','players','vote'];
  return tabs.map(id=>{
    const item=navItems.find(x=>x.id===id);
    return '<button type="button" class="'+(state.page===id?'active':'')+'" data-action="nav" data-page="'+id+'">'+ico(item.icon)+e(item.label)+'</button>';
  }).join('');
}
function renderGuest() {
  return '<div class="landing">'+
    '<section class="landing-hero"><div><span class="eyebrow">TU EQUIPO · TUS REGLAS · TU HISTORIA</span>'+
    '<h1>El partido termina.<br><em>La historia queda.</em></h1>'+
    '<p>La plataforma donde cada actuación cuenta. Vota por los jugadores de tu equipo, elige al MVP y construye un ranking que no olvida ninguna jornada.</p>'+
    '<div class="btn-row"><button class="btn" data-action="open-auth" data-mode="register">Unirme a la liga '+ico('arrow')+'</button>'+
    '<button class="btn ghost" data-action="open-auth" data-mode="login">Ya tengo cuenta</button></div>'+
    '<div class="landing-chips"><span>'+ico('shield','sm')+'Liga privada</span><span>'+ico('vote','sm')+'Votos anónimos</span><span>'+ico('trophy','sm')+'Clasificación histórica</span></div></div>'+
    '<div class="pitch-scene" aria-hidden="true"><div class="pitch-lines"></div><div class="pitch-glow"></div>'+
    '<div class="pitch-ball">'+ico('goal')+'</div>'+
    '<div class="floating-chip one"><small>'+ico('crown','sm')+' CADA JORNADA</small><strong>Un nuevo MVP.</strong></div>'+
    '<div class="floating-chip two"><small>'+ico('trend','sm')+' EL LEGADO</small><strong>Ranking eterno.</strong></div></div></section>'+
    '<section class="landing-section"><span class="eyebrow">MÁS QUE UN MARCADOR</span><h2>Donde las actuaciones <span class="lime">hablan.</span></h2>'+
    '<div class="grid-three">'+
    feature('vote','Votaciones de verdad','Notas del 0 al 10 y elección del MVP. Una cuenta, un voto por jornada.')+
    feature('trophy','Tu clasificación','Mira quién domina la jornada, el año y la historia completa de tu equipo.')+
    feature('shield','Solo tu gente','Una comunidad privada. Los administradores aprueban quién entra.')+
    '</div></section>'+
    '<section class="cta-strip"><div><span class="eyebrow">TU EQUIPO MERECE UNA HISTORIA</span><h2>El próximo MVP podría ser tú.</h2><p>La cancha decide. CanchaRank lo recuerda.</p></div>'+
    '<button class="btn" data-action="open-auth" data-mode="register">Entrar a CanchaRank '+ico('arrow')+'</button></section></div>';
}
function feature(iconName,title,description) {
  return '<article class="panel feature"><div class="feature-icon">'+ico(iconName,'lg')+'</div><h3>'+e(title)+'</h3><p>'+e(description)+'</p></article>';
}
function renderPending() {
  const has = !!state.member;
  return '<div class="pending-wrap"><section class="panel pending-panel">'+
    '<div class="empty-icon">'+ico(has?'clock':'shield')+'</div>'+
    '<span class="eyebrow">ACCESO A CANCHARANK</span>'+
    '<h1>'+(has?'Tu solicitud está en revisión':'¡Bienvenido a la cancha!')+'</h1>'+
    '<p>'+(has?'El administrador debe aprobar tu acceso. Cuando lo haga, podrás ver las jornadas, los jugadores y las clasificaciones.':
    'Solo los integrantes autorizados pueden entrar a esta liga. Cuéntanos cómo te llamas para solicitar acceso.')+'</p>'+
    (!has?'<form data-form="request" class="stack"><div class="field"><label for="member-name">Tu nombre</label><input id="member-name" name="display_name" maxlength="50" minlength="2" required placeholder="Cómo te conocen tus amigos" value="'+e(state.user?.user_metadata?.display_name||'')+'"></div><button class="btn full" type="submit">Solicitar acceso '+ico('arrow')+'</button></form>':
    '<div class="btn-row" style="justify-content:center;margin-top:25px">'+actionBtn('refresh','Consultar estado '+ico('refresh','sm'))+actionBtn('logout','Cerrar sesión','ghost')+'</div>')+
    '<p class="help" style="margin-top:22px">Cuenta: '+e(state.user?.email||'')+'</p></section></div>';
}
function metric(title,value,iconName,caption) {
  return '<article class="panel metric"><div class="metric-head"><span>'+e(title)+'</span>'+ico(iconName)+'</div><strong>'+num(value)+'</strong><small>'+e(caption)+'</small></article>';
}
function podium() {
  const first=state.globalRanking.filter(p=>Number(p.points)>0).slice(0,3);
  if (!first.length) return empt('El podio te está esperando','Cuando se registren votos, aquí aparecerán los jugadores destacados.','trophy');
  const order=[first[1],first[0],first[2]].filter(Boolean);
  return '<div class="podium">'+order.map(p=>{
    const rank=Number(p.rank_position);
    return '<div class="podium-card '+(rank===1?'first':'')+'"><div class="podium-medal">'+(rank===1?'★ CAMPEÓN':rank===2?'02 · PLATA':'03 · BRONCE')+'</div>'+avatar(p.player_name,rank)+
      '<strong>'+e(p.player_name)+'</strong><span>'+e(p.player_position)+' · '+num(p.mvp_votes)+' MVP</span><b>'+num(p.points)+' pts</b></div>';
  }).join('')+'</div>';
}
function tableRanking(rows,limit=0) {
  const data=limit?rows.slice(0,limit):rows;
  if (!data.length) return empt('Aún no hay clasificación','Crea una jornada, agrega jugadores y registra las primeras votaciones.','trophy',state.admin?actionBtn('nav','Administrar liga','secondary','data-page="admin"'):'');
  return '<div class="ranking-table-wrap"><table><thead><tr><th>#</th><th>Jugador</th><th>PTS</th><th>PJ</th><th>Media</th><th>MVP</th><th>G</th><th>A</th><th></th></tr></thead><tbody>'+
    data.map((p,index)=>'<tr><td><span class="rank-number '+(index===0?'top1':'')+'">'+num(p.rank_position)+'</span></td><td>'+playerRow(p,index)+'</td>'+
    '<td><span class="points">'+num(p.points)+'</span></td><td>'+num(p.rounds_played)+'</td><td>'+fmt(p.average_score)+'</td>'+
    '<td>'+num(p.mvp_votes)+'</td><td>'+num(p.goals)+'</td><td>'+num(p.assists)+'</td>'+
    '<td><button class="icon-btn" data-action="player-details" data-id="'+e(p.player_id)+'" aria-label="Ver perfil de '+e(p.player_name)+'">'+ico('up','sm')+'</button></td></tr>').join('')+
    '</tbody></table></div>';
}
function roundLine(r) {
  const n=participants(r.id).length;
  return '<div class="round-item"><div class="round-date"><b>'+day(r.played_on)+'</b><small>'+e(month(r.played_on))+'</small></div>'+
    '<div class="round-item-main"><strong>'+e(r.name)+'</strong><span>'+dated(r.played_on)+' · '+n+' participantes</span></div>'+
    (r.is_open?badge('ABIERTA','lime'):badge('FINALIZADA'))+
    '<div class="round-item-actions">'+actionBtn(r.is_open?'nav':'round-rank',r.is_open?ico('vote','sm')+' Votar':ico('up','sm')+' Ver',r.is_open?'':'secondary',r.is_open?'data-page="vote"':'data-id="'+e(r.id)+'"')+'</div></div>';
}
function renderHome() {
  const current=openRound();
  return '<section class="hero" style="margin-bottom:23px"><div class="hero-art">'+ico('trophy')+'</div><div class="hero-inner">'+
    '<span class="eyebrow">LA LIGA ES NUESTRA</span><h1>La gloria se gana.<br><em>El ranking se escribe.</em></h1>'+
    '<p>Una temporada de actuaciones, rivalidades sanas y momentos para recordar. Cada partido es una oportunidad de subir.</p>'+
    '<div class="hero-foot">'+(current?
      '<button class="btn" data-action="nav" data-page="vote">Votar en '+e(current.name)+' '+ico('arrow')+'</button>':
      '<button class="btn" data-action="nav" data-page="'+(state.admin?'admin':'rounds')+'">'+(state.admin?'Organizar primera jornada':'Ver jornadas')+' '+ico('arrow')+'</button>')+
    '<span class="caps">'+ico('lock','sm')+' ACCESO PRIVADO</span></div></div></section>'+
    '<section class="grid-four metrics">'+
    metric('Jugadores',state.stats.players,'users','En la plantilla')+
    metric('Jornadas',state.stats.rounds,'calendar','Disputadas / programadas')+
    metric('Votos',state.stats.votes,'vote','Papeletas registradas')+
    metric('Goles',state.stats.goals,'goal','Registrados por el equipo')+
    '</section>'+
    '<div class="split"><section class="panel"><div class="panel-title"><div><h3>'+ico('trophy','sm')+' Ranking histórico</h3><p>Los mejores de todos los tiempos.</p></div>'+
    '<button class="link-btn" data-action="nav" data-page="ranking">Ver tabla completa '+ico('arrow','sm')+'</button></div>'+tableRanking(state.globalRanking,6)+'</section>'+
    '<section class="panel"><div class="panel-title"><div><h3>El podio</h3><p>Quienes marcan el ritmo.</p></div>'+ico('crown','lg')+'</div>'+podium()+
    '<div class="divider"></div><div class="panel-title"><div><h3>Últimas jornadas</h3><p>El fútbol no se detiene.</p></div></div>'+
    (state.rounds.length?'<div class="round-list">'+state.rounds.slice(0,3).map(roundLine).join('')+'</div>':
      empt('Aún no hay jornadas','El administrador podrá crear la primera fecha.','calendar'))+
    '</section></div>';
}
function renderRanking() {
  const years=[...new Set(state.rounds.map(r=>Number(String(r.played_on).slice(0,4))))].filter(Boolean).sort((a,b)=>b-a);
  if (!years.length) years.push(new Date().getFullYear());
  if (!years.includes(Number(state.year))) years.push(Number(state.year));
  const filters='<div class="filters"><div class="segmented">'+
    [['global','Histórico'],['year','Por año'],['round','Por jornada']].map(pair=>
      '<button type="button" data-action="scope" data-scope="'+pair[0]+'" class="'+(state.scope===pair[0]?'active':'')+'">'+pair[1]+'</button>').join('')+
    '</div>'+
    (state.scope==='year'?'<div class="field"><select id="year-select" aria-label="Seleccionar año">'+years.map(y=>'<option value="'+y+'" '+(Number(state.year)===y?'selected':'')+'>'+y+'</option>').join('')+'</select></div>':'')+
    (state.scope==='round'?'<div class="field"><select id="round-select" aria-label="Seleccionar jornada">'+state.rounds.map(r=>'<option value="'+e(r.id)+'" '+(state.roundId===r.id?'selected':'')+'>'+e(r.name)+'</option>').join('')+'</select></div>':'')+
    '</div>';
  return pageTitle('Clasificación','El resultado de cada actuación, desde una jornada hasta toda la historia.')+
    '<section class="panel"><div class="panel-title"><div><h3>Tabla de posiciones</h3><p>PTS = suma de notas recibidas + 3 por cada voto a MVP. Media = promedio de notas.</p></div>'+ico('trophy','lg')+'</div>'+
    filters+tableRanking(state.ranking)+'</section>'+
    '<p class="help" style="margin-top:16px">'+ico('info','sm')+' El ranking de un año incluye solo sus jornadas. El histórico conserva todos los años.</p>';
}
function renderRounds() {
  return pageTitle('Jornadas','Cada fecha tiene su propia historia, sus participantes y un MVP.',state.admin?actionBtn('nav',ico('plus','sm')+' Nueva jornada','','data-page="admin"'):'')+
    (state.rounds.length?'<div class="grid-two">'+state.rounds.map(r=>{
      const ps=participants(r.id);
      return '<article class="panel round-card"><div class="round-card-head"><span class="eyebrow" style="margin:0">'+ico('calendar','sm')+' '+dated(r.played_on)+'</span>'+
        (r.is_open?'<span class="status-pill"><span class="dot pulse"></span>EN VIVO</span>':'<span class="status-pill closed">CERRADA</span>')+'</div>'+
        '<h3>'+e(r.name)+'</h3><p>'+ps.length+' jugadores convocados · '+(r.is_open?'Se están recibiendo votaciones':'Resultados históricos disponibles')+'</p>'+
        '<div class="round-players">'+(ps.length?ps.slice(0,6).map((p,i)=>'<span class="mini-player">'+e(p.name)+'</span>').join('')+(ps.length>6?'<span class="mini-player">+'+(ps.length-6)+'</span>':''):'<span class="muted small">Todavía no hay jugadores asociados</span>')+'</div>'+
        '<div class="divider"></div><div class="btn-row">'+actionBtn('round-rank',ico('trophy','sm')+' Resultados','secondary','data-id="'+e(r.id)+'"')+
        (r.is_open?actionBtn('nav',ico('vote','sm')+' Votar','','data-page="vote"'):'')+'</div></article>';
    }).join('')+'</div>':empt('La primera jornada está por escribirse','Todavía no se han creado fechas. El administrador puede preparar la primera.','calendar',
     state.admin?actionBtn('nav','Crear una jornada','','data-page="admin"'):''))+
    '<p class="help" style="margin-top:20px">Las fechas permanecen guardadas aunque comience un nuevo año.</p>';
}
function renderPlayers() {
  return pageTitle('La plantilla','Conoce a los protagonistas de cada jornada.',state.admin?actionBtn('nav',ico('plus','sm')+' Agregar jugador','','data-page="admin"'):'')+
    (state.players.length?
      '<div class="field" style="margin-bottom:22px;max-width:380px"><label for="player-search">Buscar un jugador</label><input id="player-search" type="search" placeholder="Nombre, dorsal o posición..." autocomplete="off"></div>'+
      '<div class="players-grid">'+state.players.map((p,i)=>{
        const row=statsFor(p.id);
        return '<article class="panel player-card" data-search="'+e((p.name+' '+p.position+' '+(p.shirt_number??'')).toLowerCase())+'">'+
          '<span class="shirt">'+(p.shirt_number!=null?'#'+e(p.shirt_number):'CR')+'</span>'+avatar(p.name,i)+
          '<h3>'+e(p.name)+'</h3><div class="player-meta">'+badge(p.position,'lime')+(p.user_id?'Cuenta vinculada':'Jugador')+'</div>'+
          '<div class="player-stats"><div><b>'+num(row.points)+'</b><small>PUNTOS</small></div><div><b>'+num(row.rounds_played)+'</b><small>JORNADAS</small></div><div><b>'+num(row.mvp_votes)+'</b><small>MVP</small></div></div>'+
          '<button class="button-cover" data-action="player-details" data-id="'+e(p.id)+'" aria-label="Ver perfil de '+e(p.name)+'"></button></article>';
      }).join('')+'</div>':
      empt('Todavía no hay plantilla','Agrega jugadores desde el panel de administración para crear el equipo.','users',
       state.admin?actionBtn('nav','Agregar jugadores','','data-page="admin"'):'' ));
}
function renderVote() {
  const current=openRound();
  if (!current) return pageTitle('Votaciones','Puntúa las actuaciones reales y elige al jugador del partido.')+
    empt('No hay votación abierta','Cuando el administrador active una jornada, podrás votar aquí.','clock');
  const eligible=participants(current.id).filter(p=>p.user_id!==state.user.id);
  const allRated=eligible.length && eligible.every(p=>Number.isInteger(state.scores[p.id]));
  const intro=pageTitle('Tu voto importa','Una evaluación por persona. Los votos individuales no son públicos.')+
    '<div class="vote-banner"><div><span class="eyebrow" style="margin:0">VOTACIÓN ACTIVA</span><h3>'+e(current.name)+'</h3>'+
    '<p>'+dated(current.played_on)+' · Notas del 0 al 10 · Elige 1 MVP</p></div><span class="status-pill"><span class="dot pulse"></span>ABIERTA</span></div>';
  if (state.hasVoted) return intro+'<section class="panel success-screen"><div class="success-illustration">'+ico('check')+'</div>'+
    '<h2>Tu voto ya está en la cancha.</h2><p>Has participado en esta jornada. Cuando termine, tus evaluaciones contribuirán a las estadísticas generales.</p>'+
    '<button class="btn" data-action="round-rank" data-id="'+e(current.id)+'">Ver clasificación '+ico('arrow')+'</button></section>';
  if (!eligible.length) return intro+empt('No tienes jugadores elegibles','Es necesario que haya participantes distintos de tu jugador vinculado para votar.','info');
  return intro+'<form data-form="vote"><div class="split"><section>'+
    eligible.map((p,i)=>{
      const rating=state.scores[p.id];
      return '<article class="vote-card"><div class="vote-card-top">'+avatar(p.name,i)+
        '<div class="vote-card-name"><strong>'+e(p.name)+'</strong><small>'+e(p.position)+' '+(p.shirt_number!=null?'· #'+e(p.shirt_number):'')+'</small></div>'+
        '<strong class="score-label">'+(Number.isInteger(rating)?rating:'—')+'<span class="muted small"> / 10</span></strong></div>'+
        '<div class="score-buttons">'+Array.from({length:11},(_,score)=>'<button type="button" class="'+(rating===score?'selected':'')+'" data-action="score" data-id="'+e(p.id)+'" data-score="'+score+'" aria-pressed="'+(rating===score)+'" aria-label="'+e(p.name)+': '+score+' puntos">'+score+'</button>').join('')+'</div>'+
        '<div class="vote-bottom"><span class="help">Tu nota es privada.</span><button class="mvp-choice '+(state.mvp===p.id?'active':'')+'" type="button" data-action="mvp" data-id="'+e(p.id)+'" aria-pressed="'+(state.mvp===p.id)+'">'+ico('crown','sm')+(state.mvp===p.id?'TU MVP':'Elegir como MVP')+'</button></div></article>';
    }).join('')+'</section><aside class="stack" style="align-self:start"><div class="panel" style="position:sticky;top:105px"><h3>Tu papeleta</h3><p class="small">Completa todas las notas y elige a tu MVP.</p>'+
    '<div class="divider"></div><div class="list-row"><span class="muted">Evaluados</span><strong>'+eligible.filter(p=>Number.isInteger(state.scores[p.id])).length+' / '+eligible.length+'</strong></div>'+
    '<div class="list-row"><span class="muted">MVP</span><strong>'+e(player(state.mvp)?.name||'Sin elegir')+'</strong></div>'+
    '<p class="help" style="margin-top:17px">'+ico('lock','sm')+' Tu voto se guarda una sola vez y no se podrá modificar.</p>'+
    '<button class="btn full" style="margin-top:10px" type="submit" '+(!allRated||!state.mvp||state.busy?'disabled':'')+'>Enviar mis votos '+ico('arrow')+'</button></div></aside></div></form>';
}
function renderAdmin() {
  const tabs=[['players','Jugadores','users'],['rounds','Jornadas','calendar'],['members','Solicitudes','shield']];
  const tabNav='<div class="admin-tabs">'+tabs.map(x=>'<button type="button" data-action="admin-tab" data-tab="'+x[0]+'" class="'+(state.adminTab===x[0]?'active':'')+'">'+ico(x[2],'sm')+x[1]+(x[0]==='members'&&state.members.filter(m=>!m.approved&&!m.blocked).length?' ('+state.members.filter(m=>!m.approved&&!m.blocked).length+')':'')+'</button>').join('')+'</div>';
  let body='';
  if (state.adminTab==='players') {
    body='<div class="split"><section class="panel"><div class="panel-title"><h3>Plantilla actual</h3>'+badge(state.players.length+' jugadores')+'</div>'+
    (state.players.length?state.players.map((p,i)=>'<div class="list-row"><div class="list-row-main">'+avatar(p.name,i)+'<div><strong>'+e(p.name)+' '+(p.shirt_number!=null?'#'+e(p.shirt_number):'')+'</strong><p>'+e(p.position)+' '+(p.user_id?'· vinculado':'· sin vincular')+'</p></div></div>'+
    '<div class="list-row-actions"><button class="icon-btn" data-action="edit-player" data-id="'+e(p.id)+'" aria-label="Editar '+e(p.name)+'">'+ico('edit','sm')+'</button>'+
    '<button class="icon-btn" data-action="delete-player" data-id="'+e(p.id)+'" aria-label="Borrar '+e(p.name)+'">'+ico('trash','sm')+'</button></div></div>').join(''):
    empt('Plantilla vacía','Agrega al primer jugador desde el formulario.','users'))+'</section>'+
    '<section class="panel"><div class="panel-title"><h3>'+ico('plus','sm')+' Nuevo jugador</h3></div>'+
    '<form data-form="add-player" class="stack">'+
    field('Nombre del jugador','<input required name="name" maxlength="50" placeholder="Ej.: Alejandro">')+
    '<div class="form-grid">'+field('Posición',positionSelect())+
    field('Dorsal (opcional)','<input type="number" name="shirt_number" min="0" max="99" placeholder="14">')+'</div>'+
    '<p class="help">Podrás vincular cada jugador a una cuenta desde el botón editar. Así nadie podrá evaluarse a sí mismo.</p>'+
    '<button type="submit" class="btn full">'+ico('plus','sm')+' Agregar jugador</button></form></section></div>';
  } else if (state.adminTab==='rounds') {
    body='<div class="split"><section class="panel"><div class="panel-title"><h3>Jornadas creadas</h3>'+badge(state.rounds.length+' fechas')+'</div>'+
    (state.rounds.length?state.rounds.map(r=>'<div class="list-row"><div class="list-row-main"><div class="round-date"><b>'+day(r.played_on)+'</b><small>'+e(month(r.played_on))+'</small></div>'+
      '<div><strong>'+e(r.name)+'</strong><p>'+participants(r.id).length+' jugadores · '+(r.is_open?'Votación abierta':'Cerrada')+'</p></div></div>'+
      '<div class="list-row-actions"><button class="icon-btn" data-action="manage-round" data-id="'+e(r.id)+'" title="Participantes y estadísticas">'+ico('edit','sm')+'</button>'+
      '<button class="btn '+(r.is_open?'danger':'secondary')+' sm" data-action="toggle-round" data-id="'+e(r.id)+'">'+(r.is_open?'Cerrar':'Abrir')+'</button></div></div>').join(''):
      empt('Sin jornadas','Crea la primera fecha de tu liga.','calendar'))+
    '<p class="help" style="margin-top:15px">Solo puede haber una votación abierta a la vez.</p></section>'+
    '<section class="panel"><div class="panel-title"><h3>'+ico('plus','sm')+' Nueva jornada</h3></div>'+
    '<form data-form="add-round" class="stack">'+field('Nombre de jornada','<input name="name" maxlength="60" placeholder="Ej.: Jornada 1" required>')+
    field('Fecha del partido','<input type="date" name="played_on" value="'+today()+'" required>')+
    '<p class="help">Primero crea la jornada y añade participantes. Luego podrás abrir la votación.</p>'+
    '<button class="btn full" type="submit">'+ico('plus','sm')+' Crear jornada</button></form></section></div>';
  } else {
    const pending=state.members.filter(m=>!m.approved&&!m.blocked);
    const approved=state.members.filter(m=>m.approved&&!m.blocked);
    body='<section class="panel"><div class="panel-title"><div><h3>Solicitudes de acceso</h3><p>Solo las personas aprobadas pueden ver estadísticas o votar.</p></div>'+badge(pending.length+' pendientes',pending.length?'gold':'')+'</div>'+
      (pending.length?pending.map(m=>memberLine(m)).join(''):empt('Todo al día','No tienes solicitudes pendientes de revisión.','check'))+'</section>'+
      '<section class="panel" style="margin-top:20px"><div class="panel-title"><h3>Miembros aprobados</h3>'+badge(approved.length+' miembros')+'</div>'+
      approved.map(m=>memberLine(m)).join('')+'</section>';
  }
  return pageTitle('Panel de control','Gestiona tu liga desde un solo lugar. Solo visible para administradores.')+
    tabNav+body;
}
function field(label,markup) {return '<div class="field"><label>'+e(label)+'</label>'+markup+'</div>';}
function positionSelect(value='MC') {
  return '<select name="position">'+['POR','DFC','LD','LI','MCD','MC','MCO','EI','ED','DC','SD'].map(p=>
    '<option '+(p===value?'selected':'')+' value="'+p+'">'+p+'</option>').join('')+'</select>';
}
function memberLine(m) {
  const me=state.user?.id===m.user_id;
  return '<div class="list-row"><div class="list-row-main">'+avatar(m.display_name)+'<div><strong>'+e(m.display_name)+(me?' (tú)':'')+'</strong><p>'+e(m.email)+(m.blocked?' · Bloqueado':'')+'</p></div></div>'+
    '<div class="btn-row">'+(m.approved&&!m.blocked?badge('ACTIVO','lime'):'')+
    (!m.approved||m.blocked?actionBtn('approve-member','Aprobar','','data-id="'+e(m.user_id)+'"'):'')+
    (!me&&m.approved&&!m.blocked?actionBtn('block-member','Bloquear','danger','data-id="'+e(m.user_id)+'"'):'')+'</div></div>';
}
function renderHistory(history) {
  if(history===null) return '<div class="loading-state" style="min-height:120px"><div class="loading-spinner"></div><p>Cargando historial...</p></div>';
  if(!history.length) return empt('Sin historial todavía','Este jugador aún no ha sido convocado a ninguna jornada.','calendar');
  const chart=[...history].reverse().slice(-10);
  const max=Math.max(1,...chart.map(x=>Number(x.points)||0));
  return '<div class="history-chart" aria-label="Evolución de puntos por jornada">'+chart.map(h=>{
    const pct=Math.max(5,Math.round((Number(h.points)||0)/max*100));
    return '<div class="history-col" title="'+e(h.round_name)+': '+num(h.points)+' puntos">'+
      '<b>'+num(h.points)+'</b><div class="history-track"><div class="history-fill" style="height:'+pct+'%"></div></div>'+
      '<small>'+e(String(h.played_on).slice(5))+'</small></div>';
  }).join('')+'</div><div class="history-list">'+history.map(h=>
    '<div class="list-row"><div><strong>'+e(h.round_name)+'</strong><p class="small" style="margin:2px 0 0">'+dated(h.played_on)+' · '+fmt(h.average_score)+' de media · '+num(h.mvp_votes)+' MVP</p></div>'+
    '<div style="text-align:right"><strong class="lime">'+num(h.points)+' pts</strong><p class="small" style="margin:2px 0 0">'+num(h.goals)+' G / '+num(h.assists)+' A</p></div></div>').join('')+'</div>';
}
function renderModal() {
  const m=state.modal;
  if (!m) return '';
  let body='',wide=false;
  if (m.type==='auth') {
    const isSignup=state.authMode==='register';
    body='<div class="modal-head"><div><span class="eyebrow">BIENVENIDO A LA LIGA</span><h2>'+(isSignup?'Crear una cuenta':'Volver a la cancha')+'</h2></div>'+
      '<button class="icon-btn" data-action="close-modal" aria-label="Cerrar">'+ico('x')+'</button></div>'+
      '<p class="small">'+(isSignup?'Regístrate y pide acceso a tu liga privada.':'Ingresa para volver a las votaciones y clasificaciones.')+'</p>'+
      '<form data-form="'+(isSignup?'signup':'login')+'">'+
      (isSignup?field('Tu nombre','<input name="name" required minlength="2" maxlength="50" autocomplete="name" placeholder="Cómo te conocen en el equipo">'):'')+
      field('Correo electrónico','<input name="email" type="email" autocomplete="email" required placeholder="tu@correo.cl">')+
      field('Contraseña','<input name="password" type="password" autocomplete="'+(isSignup?'new-password':'current-password')+'" required minlength="6" placeholder="Mínimo 6 caracteres">')+
      '<button type="submit" class="btn full">'+(isSignup?'Crear cuenta':'Iniciar sesión')+' '+ico('arrow')+'</button></form>'+
      '<div class="divider"></div><form data-form="magic-link"><div class="field"><label>¿Prefieres entrar por correo?</label><input name="email" type="email" required placeholder="tu@correo.cl"></div><button type="submit" class="btn ghost full">'+ico('mail','sm')+' Enviarme un enlace para ingresar</button></form>'+
      '<p class="modal-foot" style="margin-top:18px">'+(isSignup?'¿Ya tienes cuenta?':'¿Aún no tienes una cuenta?')+' <button type="button" data-action="auth-mode" data-mode="'+(isSignup?'login':'register')+'">'+(isSignup?'Iniciar sesión':'Registrarme')+'</button></p>';
  } else if (m.type==='player') {
    const p=player(m.id);if (!p) return '';
    const s=statsFor(p.id);
    body='<div class="modal-head"><div><span class="eyebrow">FICHA DEL JUGADOR</span><h2>'+e(p.name)+'</h2></div><button class="icon-btn" data-action="close-modal">'+ico('x')+'</button></div>'+
      '<div style="display:flex;gap:15px;align-items:center;margin-bottom:22px">'+avatar(p.name)+'<div>'+badge(p.position,'lime')+
      '<p class="small" style="margin:6px 0 0">Dorsal '+(p.shirt_number!=null?'#'+e(p.shirt_number):'sin asignar')+'</p></div></div>'+
      '<div class="grid-two">'+metric('Puntos',s.points,'trophy','Histórico')+metric('Promedio',fmt(s.average_score),'trend','Notas recibidas')+
      metric('MVP',s.mvp_votes,'crown','Votos a mejor jugador')+metric('Partidos',s.rounds_played,'calendar','Jornadas jugadas')+
      metric('Goles',s.goals,'goal','Registrados')+metric('Asistencias',s.assists,'activity','Registradas')+'</div>'+
      '<div class="divider"></div><div class="panel-title"><div><h3>Evolución por jornada</h3><p>Historial completo de puntos, goles, asistencias y MVP.</p></div>'+ico('trend')+'</div>'+renderHistory(m.history);
    wide=true;
  } else if(m.type==='edit-player') {
    const p=player(m.id);if(!p)return '';
    const memberOptions=state.members.filter(x=>x.approved&&!x.blocked)
      .map(x=>'<option value="'+e(x.user_id)+'" '+(p.user_id===x.user_id?'selected':'')+'>'+e(x.display_name)+'</option>').join('');
    body='<div class="modal-head"><h2>Editar jugador</h2><button class="icon-btn" data-action="close-modal">'+ico('x')+'</button></div>'+
      '<form data-form="edit-player" data-id="'+e(p.id)+'">'+
      field('Nombre','<input name="name" required maxlength="50" value="'+e(p.name)+'">')+
      '<div class="form-grid">'+field('Posición',positionSelect(p.position))+field('Dorsal','<input name="shirt_number" type="number" min="0" max="99" value="'+(p.shirt_number??'')+'">')+'</div>'+
      field('Vincular cuenta (evita autoevaluación)','<select name="user_id"><option value="">Sin vincular</option>'+memberOptions+'</select>')+
      '<p class="help">Un jugador vinculado a su cuenta no podrá puntuarse ni elegirse MVP a sí mismo.</p>'+
      '<div class="form-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn">Guardar cambios</button></div></form>';
  } else if(m.type==='manage-round') {
    const r=round(m.id);if(!r)return '';
    const included=new Set(participants(r.id).map(p=>p.id));
    const locked=m.votes>0;
    wide=true;
    body='<div class="modal-head"><div><span class="eyebrow">GESTIÓN DE FECHA</span><h2>'+e(r.name)+'</h2></div><button class="icon-btn" data-action="close-modal">'+ico('x')+'</button></div>'+
      '<p class="small">Selecciona participantes y registra goles o asistencias reales. '+(locked?'Esta fecha ya tiene votos; no se pueden cambiar sus participantes.':'Puedes convocar o desconvocar jugadores antes de recibir votos.')+'</p>'+
      '<form data-form="manage-round" data-id="'+e(r.id)+'">'+
      '<div class="form-grid">'+field('Nombre de la jornada','<input name="round_name" required maxlength="60" value="'+e(r.name)+'">')+
      field('Fecha del partido','<input name="played_on" type="date" required value="'+e(r.played_on)+'">')+'</div><div class="participant-list">'+
      (state.players.length?state.players.map(p=>{
        const perf=state.performances.find(x=>x.round_id===r.id&&x.player_id===p.id);
        return '<div class="participant-row"><input aria-label="Convocar '+e(p.name)+'" type="checkbox" name="p_'+e(p.id)+'" '+(included.has(p.id)?'checked':'')+' '+(locked?'disabled':'')+'>'+
          '<span class="participant-name">'+e(p.name)+' <span class="muted small">'+e(p.position)+'</span></span>'+
          '<label>Goles <input class="small-input" type="number" name="goals_'+e(p.id)+'" value="'+num(perf?.goals||0)+'" min="0" max="30"></label>'+
          '<label>Asist. <input class="small-input" type="number" name="assists_'+e(p.id)+'" value="'+num(perf?.assists||0)+'" min="0" max="30"></label></div>';
      }).join(''):empt('Sin jugadores','Agrega jugadores primero desde el panel de plantilla.','users'))+'</div>'+
      '<p class="help">'+(locked?'La convocatoria está bloqueada porque ya hay '+num(m.votes)+' votos. Solo puedes actualizar goles y asistencias.':'Cuando termines, pulsa Guardar y luego abre la votación.')+'</p>'+
      '<div class="form-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancelar</button><button type="submit" class="btn">Guardar jornada '+ico('check','sm')+'</button></div></form>';
  }
  return '<div class="overlay" data-overlay="true"><section role="dialog" aria-modal="true" aria-label="CanchaRank" class="modal '+(wide?'wide':'')+'">'+body+'</section></div>';
}
function render() {
  const guest = !state.allowed;
  byId('shell').classList.toggle('guest',guest);
  byId('sidebar').innerHTML=sidebar();
  byId('topbar').innerHTML=topbar();
  byId('mobile-nav').innerHTML=mobileNav();
  if (state.loading) root.innerHTML=loadingHTML();
  else if (!state.user) root.innerHTML=renderGuest();
  else if (!state.allowed) root.innerHTML=renderPending();
  else {
    root.innerHTML=({
      home:renderHome,ranking:renderRanking,rounds:renderRounds,
      players:renderPlayers,vote:renderVote,admin:renderAdmin
    }[state.page]||renderHome)();
  }
  byId('modal-root').innerHTML=renderModal();
  document.body.style.overflow=state.modal?'hidden':'';
}
async function bootstrap() {
  const seq=++bootSeq;
  state.loading=true; render();
  try {
    const auth=await db.auth.getUser();
    if (auth.error && !/session missing/i.test(auth.error.message||'')) throw auth.error;
    const user=auth.data?.user||null;
    if (seq!==bootSeq)return;
    state.user=user;state.admin=false;state.allowed=false;state.member=null;
    if (!user) {
      state.players=[];state.rounds=[];state.roundPlayers=[];state.performances=[];
      state.members=[];state.ranking=[];state.globalRanking=[];
      state.loading=false;render();return;
    }
    const results=await Promise.all([
      db.rpc('is_admin'),
      db.from('members').select('user_id,display_name,email,approved,blocked').eq('user_id',user.id).maybeSingle()
    ]);
    if (seq!==bootSeq)return;
    state.admin=!!check(results[0]);
    state.member=check(results[1]);
    state.allowed=state.admin||!!(state.member?.approved&&!state.member?.blocked);
    if (!state.member && user.user_metadata?.display_name && !state.admin) {
      await db.rpc('request_access',{p_name:user.user_metadata.display_name});
      state.member=check(await db.from('members').select('user_id,display_name,email,approved,blocked').eq('user_id',user.id).maybeSingle());
      state.allowed=!!(state.member?.approved&&!state.member?.blocked);
    }
    if(state.allowed) await fetchData();
    if(seq!==bootSeq)return;
    state.loading=false;render();
  } catch(err) {
    if(seq!==bootSeq)return;
    state.loading=false;render();failure(err);
  }
}
async function fetchData() {
  const queries=[
    db.from('players').select('id,name,user_id,position,shirt_number,created_at').order('name'),
    db.from('rounds').select('id,name,played_on,is_open,created_at').order('played_on',{ascending:false}),
    db.from('round_players').select('round_id,player_id'),
    db.from('player_performances').select('round_id,player_id,goals,assists'),
    db.rpc('get_rankings',{p_scope:'global'}),
    db.rpc('get_site_stats')
  ];
  if(state.admin)queries.push(db.from('members').select('user_id,display_name,email,approved,blocked,created_at').order('created_at',{ascending:false}));
  const results=await Promise.all(queries);
  const data=results.map(check);
  state.players=data[0]||[];
  state.rounds=data[1]||[];
  state.roundPlayers=data[2]||[];
  state.performances=data[3]||[];
  state.globalRanking=data[4]||[];
  state.stats=data[5]||{};
  state.members=state.admin?(data[6]||[]):[];
  if(!state.roundId || !round(state.roundId))state.roundId=state.rounds[0]?.id||null;
  const open=openRound();
  if(state.selectedVoteRound!==open?.id) {
    state.selectedVoteRound=open?.id||null;state.scores={};state.mvp=null;
  }
  if(open) state.hasVoted=!!check(await db.rpc('get_my_vote',{p_round:open.id}));
  else state.hasVoted=false;
  await loadRanking();
}
async function loadRanking() {
  if(state.scope==='global') {state.ranking=state.globalRanking;return;}
  if(state.scope==='round'&&!state.roundId) {state.ranking=[];return;}
  const params=state.scope==='year'?{p_scope:'year',p_year:Number(state.year)}:{p_scope:'round',p_round:state.roundId};
  state.ranking=check(await db.rpc('get_rankings',params))||[];
}
async function reload() {
  if(!state.user)return bootstrap();
  state.loading=true;render();
  try {await fetchData();state.loading=false;render();}
  catch(err){state.loading=false;render();failure(err);}
}
async function run(fn) {
  if(state.busy)return;
  state.busy=true;
  try {await fn();}catch(err){failure(err);}finally{state.busy=false;}
}
async function handleClick(event) {
  const btn=event.target.closest('[data-action]');
  if(!btn) {
    if(event.target.matches('[data-overlay]')){state.modal=null;render();}
    return;
  }
  const action=btn.dataset.action,id=btn.dataset.id;
  if(action==='open-auth') {
    state.authMode=btn.dataset.mode||'login';state.modal={type:'auth'};render();return;
  }
  if(action==='close-modal'){state.modal=null;render();return;}
  if(action==='auth-mode'){state.authMode=btn.dataset.mode||'login';render();return;}
  if(action==='logout'){await run(async()=>{check(await db.auth.signOut());state.modal=null;await bootstrap();});return;}
  if(action==='refresh'){await bootstrap();return;}
  if(action==='nav'){
    const page=btn.dataset.page;
    if(page==='admin'&&!state.admin)return;
    if(!navItems.find(x=>x.id===page))return;
    state.page=page;state.modal=null;render();window.scrollTo({top:0,behavior:'smooth'});return;
  }
  if(!state.allowed)return;
  if(action==='scope'){
    state.scope=btn.dataset.scope;
    await run(async()=>{await loadRanking();render();});return;
  }
  if(action==='round-rank'){
    state.page='ranking';state.scope='round';state.roundId=id;
    await run(async()=>{await loadRanking();render();window.scrollTo(0,0);});return;
  }
  if(action==='score'){
    state.scores[id]=Number(btn.dataset.score);render();return;
  }
  if(action==='mvp'){state.mvp=id;render();return;}
  if(action==='player-details'){
    state.modal={type:'player',id,history:null};render();
    await run(async()=>{
      const history=check(await db.rpc('get_player_history',{p_player:id}))||[];
      if(state.modal?.type==='player' && state.modal.id===id){
        state.modal.history=history;render();
      }
    });return;
  }
  if(!state.admin)return;
  if(action==='admin-tab'){state.adminTab=btn.dataset.tab;render();return;}
  if(action==='edit-player'){state.modal={type:'edit-player',id};render();return;}
  if(action==='delete-player'){
    const p=player(id);if(!p||!window.confirm('¿Eliminar a '+p.name+'? Si ya tiene votos históricos, no se podrá borrar.'))return;
    await run(async()=>{check(await db.from('players').delete().eq('id',id));toast('Jugador eliminado');await reload();});
    return;
  }
  if(action==='approve-member'||action==='block-member') {
    if(action==='block-member'&&!window.confirm('¿Bloquear el acceso de este miembro?'))return;
    const changes=action==='approve-member'?{approved:true,blocked:false}:{approved:false,blocked:true};
    await run(async()=>{check(await db.from('members').update(changes).eq('user_id',id));toast(action==='approve-member'?'Miembro aprobado':'Miembro bloqueado');await reload();});
    return;
  }
  if(action==='manage-round'){
    await run(async()=>{
      const votes=check(await db.rpc('get_round_vote_count',{p_round:id}))||0;
      state.modal={type:'manage-round',id,votes:Number(votes)};render();
    });return;
  }
  if(action==='toggle-round'){
    const r=round(id);if(!r)return;
    if(!r.is_open&&!participants(id).length){toast('Añade participantes antes de abrir esta jornada',true);return;}
    if(!window.confirm(r.is_open?'¿Cerrar la votación de '+r.name+'?':'¿Abrir la votación de '+r.name+'?'))return;
    await run(async()=>{
      if(!r.is_open) {
        const previous=openRound();
        if(previous)check(await db.from('rounds').update({is_open:false}).eq('id',previous.id));
      }
      check(await db.from('rounds').update({is_open:!r.is_open}).eq('id',id));
      toast(r.is_open?'Votación cerrada':'Votación abierta');await reload();
    });return;
  }
}
async function handleSubmit(event) {
  const form=event.target.closest('form[data-form]');
  if(!form)return;
  event.preventDefault();
  if(state.busy)return;
  const type=form.dataset.form, fd=new FormData(form), get=name=>String(fd.get(name)||'').trim();
  if(type==='login'){
    await run(async()=>{
      const email=get('email'),password=get('password');
      check(await db.auth.signInWithPassword({email,password}));
      state.modal=null;toast('¡Bienvenido de vuelta!');await bootstrap();
    });return;
  }
  if(type==='signup'){
    await run(async()=>{
      const name=get('name'),email=get('email'),password=get('password');
      if(name.length<2)throw new Error('Escribe tu nombre');
      const response=await db.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname,data:{display_name:name}}});
      check(response);
      state.modal=null;
      toast(response.data.session?'Cuenta creada. Solicita tu acceso.':'Cuenta creada. Comprueba tu correo para confirmar la cuenta.');
      await bootstrap();
    });return;
  }
  if(type==='magic-link'){
    await run(async()=>{
      check(await db.auth.signInWithOtp({
        email:get('email'),
        options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+window.location.pathname}
      }));
      toast('Enviamos un enlace a tu correo. Revisa también Spam.');state.modal=null;render();
    });return;
  }
  if(type==='request'){
    await run(async()=>{
      check(await db.rpc('request_access',{p_name:get('display_name')}));
      toast('Solicitud enviada al administrador');await bootstrap();
    });return;
  }
  if(!state.allowed)return;
  if(type==='vote'){
    const r=openRound();if(!r)return;
    const eligible=participants(r.id).filter(p=>p.user_id!==state.user.id);
    if(!eligible.length||!state.mvp||eligible.some(p=>!Number.isInteger(state.scores[p.id]))) {
      toast('Debes evaluar a todos y elegir un MVP',true);return;
    }
    await run(async()=>{
      check(await db.rpc('submit_ballot',{p_round:r.id,p_mvp:state.mvp,p_ratings:state.scores}));
      state.hasVoted=true;state.scores={};state.mvp=null;
      toast('¡Tu voto se registró correctamente!');await reload();
    });return;
  }
  if(!state.admin)return;
  if(type==='add-player'||type==='edit-player'){
    const payload={name:get('name'),position:get('position')||'MC',shirt_number:get('shirt_number')===''?null:Number(get('shirt_number'))};
    if(payload.name.length<1||payload.name.length>50)throwOrToast('Nombre inválido');
    if(type==='edit-player')payload.user_id=get('user_id')||null;
    await run(async()=>{
      check(type==='add-player'?await db.from('players').insert(payload):await db.from('players').update(payload).eq('id',form.dataset.id));
      state.modal=null;toast(type==='add-player'?'Jugador agregado':'Jugador actualizado');await reload();
    });return;
  }
  if(type==='add-round'){
    await run(async()=>{
      check(await db.from('rounds').insert({name:get('name'),played_on:get('played_on'),is_open:false}));
      state.adminTab='rounds';toast('Jornada creada. Ahora añade sus participantes.');await reload();
    });return;
  }
  if(type==='manage-round'){
    const id=form.dataset.id, m=state.modal;
    const editedRound={name:get('round_name'),played_on:get('played_on')};
    if(!editedRound.name||!editedRound.played_on){toast('Completa el nombre y la fecha',true);return;}
    const selected=state.players.filter(p=>fd.has('p_'+p.id)).map(p=>p.id);
    const existing=participants(id).map(p=>p.id);
    if(m?.votes>0){selected.splice(0,selected.length,...existing);}
    const add=selected.filter(pid=>!existing.includes(pid));
    const remove=existing.filter(pid=>!selected.includes(pid));
    await run(async()=>{
      check(await db.from('rounds').update(editedRound).eq('id',id));
      if(remove.length)check(await db.from('round_players').delete().eq('round_id',id).in('player_id',remove));
      if(add.length)check(await db.from('round_players').insert(add.map(pid=>({round_id:id,player_id:pid}))));
      const performances=selected.map(pid=>({
        round_id:id,player_id:pid,goals:Number(get('goals_'+pid)||0),assists:Number(get('assists_'+pid)||0)
      }));
      if(performances.some(p=>!Number.isInteger(p.goals)||p.goals<0||p.goals>30||
        !Number.isInteger(p.assists)||p.assists<0||p.assists>30))throw new Error('Goles y asistencias deben estar entre 0 y 30');
      if(performances.length)check(await db.from('player_performances').upsert(performances,{onConflict:'round_id,player_id'}));
      state.modal=null;toast('Jornada actualizada');await reload();
    });return;
  }
}
function throwOrToast(msg){toast(msg,true);throw new Error(msg);}
document.addEventListener('click',event=>{handleClick(event).catch(failure);});
document.addEventListener('submit',event=>{handleSubmit(event).catch(failure);});
document.addEventListener('change',async event=>{
  if(event.target.id==='year-select'){
    state.year=Number(event.target.value);
    try{await loadRanking();render();}catch(err){failure(err);}
  }
  if(event.target.id==='round-select'){
    state.roundId=event.target.value;
    try{await loadRanking();render();}catch(err){failure(err);}
  }
});
document.addEventListener('input',event=>{
  if(event.target.id==='player-search'){
    const q=event.target.value.toLowerCase().trim();
    document.querySelectorAll('.player-card[data-search]').forEach(card=>{card.hidden=!card.dataset.search.includes(q);});
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&state.modal){state.modal=null;render();}
});
db.auth.onAuthStateChange((_event,session)=>{
  setTimeout(()=>{
    if(session?.user?.id!==state.user?.id)bootstrap();
  },0);
});
byId('copyright-year').textContent=new Date().getFullYear();
bootstrap();
