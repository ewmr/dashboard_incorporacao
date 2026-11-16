/* Acesso ao Registro de Desvios: só a equipe de Gestão de Projetos de Incorporação registra.
   As senhas não ficam no código: guardamos só a impressão (PBKDF2-SHA256, 210000 iterações, sal por usuário).
   Esta é uma barreira de uso, não de segurança: o envio ao ClickUp continua exigindo acesso de escrita ao repositório. */
const GPI_USERS = [{"nome": "Eduardo Rosa", "sal": "cecf157caaa3951771ce267a293e62df", "h": "f6c590cce58e51be5e51159f987b4056f74404aa39013abdfca2f3a73f19355a"}, {"nome": "Isabela Raizel", "sal": "797929a9752264eae1d0111e4e776df9", "h": "c367ec569eb5d928b30b5cde2d7889c5dc382fc8156ba3a83d998bec07bcd52a"}, {"nome": "Lidia Lhose", "sal": "d361ac001eaecb35978b431946e3c2bf", "h": "4bafdb510cb5a5a4f9309702e1d033a10d709bc91d6684675caa0d353a1ac1f9"}];
const GPI_IT = 210000, GPI_K = "gpi-sessao", GPI_H = 12;
const gpiHex = b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function gpiConfere(nome, senha){
  const u = GPI_USERS.find(x=>x.nome===nome); if (!u || !senha) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt:new Uint8Array(u.sal.match(/../g).map(h=>parseInt(h,16))), iterations:GPI_IT}, k, 256);
  return gpiHex(bits) === u.h;
}
function gpiSessao(){ try { const s = JSON.parse(localStorage.getItem(GPI_K)||"null"); if (s && s.nome && s.exp > Date.now() && GPI_USERS.some(u=>u.nome===s.nome)) return s; } catch(e){} return null; }
async function gpiEntra(nome, senha){ if (!(await gpiConfere(nome, senha))) return null; const s = {nome, exp: Date.now()+GPI_H*36e5}; try { localStorage.setItem(GPI_K, JSON.stringify(s)); } catch(e){} return s; }
function gpiSai(){ try { localStorage.removeItem(GPI_K); } catch(e){} }
