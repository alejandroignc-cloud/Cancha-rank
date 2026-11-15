// Prueba local sin dependencias: node tests/smoke.cjs
// Comprueba que las vistas básicas renderizan incluso sin datos de la liga.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '..', 'app.js');
const js = fs.readFileSync(file, 'utf8')
  .replace(/^import .*;$/gm, '')
  .replace(/bootstrap\(\);\s*$/, '');

const elements = {};
const fakeDoc = {
  getElementById(id) {
    if (!elements[id]) elements[id] = {
      innerHTML: '', textContent: '', style: {}, classList: { toggle() {} }
    };
    return elements[id];
  },
  addEventListener() {},
  querySelectorAll() { return []; },
  body: { style: {} }
};
const context = {
  document: fakeDoc,
  window: { scrollTo() {}, confirm() { return true; },
    location: { origin: 'https://example.com', pathname: '/Cancha-rank/' } },
  setTimeout() { return 1; }, clearTimeout() {},
  console,
  createClient() { return { auth: { onAuthStateChange() {} } }; },
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_KEY: 'sb_publishable_test'
};
vm.createContext(context);
vm.runInContext(js + '\n globalThis.testApi = { state, render };', context);
const {state, render} = context.testApi;
state.loading = false;
render();
assert.match(elements.app.innerHTML, /La historia queda/);

state.user = {id:'test-user',email:'test@example.com'};
state.member = {display_name:'Usuario', approved:false,blocked:false};
render();
assert.match(elements.app.innerHTML, /solicitud está en revisión/);

state.member.approved = true;
state.allowed = true;
state.admin = true;
state.stats = {players:0,rounds:0,votes:0,goals:0};
for (const page of ['home','ranking','rounds','players','vote','admin']) {
  state.page = page;
  render();
  assert.ok(elements.app.innerHTML.length > 200, 'Vista vacía: '+page);
}
state.players = [
  {id:'player-1',name:'Jugador de prueba',position:'MC',shirt_number:14,user_id:null}
];
state.rounds = [
  {id:'round-1',name:'Jornada de prueba',played_on:'2026-11-15',is_open:true}
];
state.roundPlayers = [{round_id:'round-1',player_id:'player-1'}];
state.globalRanking = [{
  rank_position:1,player_id:'player-1',player_name:'Jugador de prueba',
  player_position:'MC',shirt_number:14,points:13,average_score:10,
  ratings_count:1,mvp_votes:1,rounds_played:1,goals:1,assists:0
}];
state.ranking = state.globalRanking;
state.stats = {players:1,rounds:1,votes:1,goals:1};
for (const page of ['home','ranking','rounds','players','vote','admin']) {
  state.page = page; render();
  assert.ok(elements.app.innerHTML.length > 400, 'Falla con datos: '+page);
}
state.modal = {type:'player',id:'player-1',history:[{
  round_name:'Jornada de prueba',played_on:'2026-11-15',
  points:13,average_score:10,mvp_votes:1,goals:1,assists:0
}]};
render();
assert.match(elements['modal-root'].innerHTML, /Evolución por jornada/);
console.log('CanchaRank: 15 pruebas de interfaz completadas.');
