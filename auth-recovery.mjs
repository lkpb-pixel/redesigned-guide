export const APP_URL = 'https://lkpb-pixel.github.io/redesigned-guide/';
export const isRecoveryLink = hash => new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery';

export async function requestRecovery(auth, email) {
  email = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  const { error } = await auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
  if (error) throw error;
}

export async function changeRecoveredPassword(auth, password, confirmation) {
  if (!(password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password))) {
    throw new Error('Use 10+ caracteres com maiúscula, minúscula, número e símbolo.');
  }
  if (password !== confirmation) throw new Error('As duas senhas precisam ser iguais.');
  const { error } = await auth.updateUser({ password });
  if (error) throw error;
}

export function setupRecovery(auth, { document, location, history, storage }) {
  const $ = id => document.getElementById(id);
  const hidden = (id, value) => $(id).classList.toggle('hidden', value);
  const marker = 'controle-casal-password-recovery';
  const readMarker = () => { try { return storage.getItem(marker) === '1'; } catch { return false; } };
  const mark = value => { try { value ? storage.setItem(marker, '1') : storage.removeItem(marker); } catch {} };
  let active = isRecoveryLink(location.hash) || readMarker();
  let ready = false;
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const linkError = params.has('error') || params.has('error_code');
  const showMessage = (id, text, type='err') => { $(id).textContent=text; $(id).className=`inline-message ${type}`; };
  const showRecovery = () => {
    active=true; mark(true);
    ['authScreen','appScreen','onboardingScreen'].forEach(id=>hidden(id,true));
    hidden('recoveryScreen',false);
    $('savePasswordBtn').disabled=!ready;
  };
  if(active) showRecovery();
  if(linkError) {
    active=false; mark(false); hidden('recoveryScreen',true); hidden('authScreen',false);
    showMessage('authMsg','Este link expirou ou já foi usado. Clique em “Esqueci minha senha” para receber outro.');
    history.replaceState(null,'',location.pathname + location.search);
  }
  // Subscribe before getSession: recovery can be emitted during client initialization.
  auth.onAuthStateChange((event, session) => {
    if(event==='PASSWORD_RECOVERY') { ready=!!session; showRecovery(); }
    if(event==='SIGNED_OUT') { active=false; ready=false; mark(false); hidden('recoveryScreen',true); }
  });
  $('forgotPasswordBtn').onclick=async()=>{
    const button=$('forgotPasswordBtn'); button.disabled=true;
    try {
      await requestRecovery(auth,$('emailInput').value);
      showMessage('authMsg','Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também o spam.','ok');
    } catch(error) {
      showMessage('authMsg',error.status===429?'Aguarde um minuto antes de pedir outro e-mail.':error.message==='Informe um e-mail válido.'?error.message:'Não foi possível enviar o link. Tente novamente em alguns minutos.');
    } finally { button.disabled=false; }
  };
  $('recoveryForm').addEventListener('submit',async event=>{
    event.preventDefault(); if(!ready)return;
    const button=$('savePasswordBtn'); button.disabled=true;
    try {
      await changeRecoveredPassword(auth,$('newPasswordInput').value,$('confirmPasswordInput').value);
      ready=false; active=false; mark(false); $('recoveryForm').reset();
      await auth.signOut({scope:'local'});
      history.replaceState(null,'',location.pathname + location.search);
      hidden('recoveryScreen',true); hidden('appScreen',true); hidden('onboardingScreen',true); hidden('authScreen',false);
      $('passwordInput').value='';
      showMessage('authMsg','Senha atualizada. Entre com seu e-mail e a nova senha.','ok');
    } catch(error) {
      const validation=/10\+|iguais/.test(error.message);
      showMessage('recoveryMsg',validation?error.message:error.code==='same_password'?'Escolha uma senha diferente da anterior.':'Não foi possível alterar a senha. O link pode ter expirado; volte para entrar e solicite outro.');
    } finally { button.disabled=!ready; }
  });
  $('cancelRecoveryBtn').onclick=async()=>{
    active=false; ready=false; mark(false);
    await auth.signOut({scope:'local'});
    history.replaceState(null,'',location.pathname + location.search);
    hidden('recoveryScreen',true); hidden('authScreen',false);
  };
  return {
    get active(){ return active; },
    acceptSession(session){
      if(!active)return;
      ready=!!session;
      showRecovery();
      if(!ready)showMessage('recoveryMsg','Este link expirou ou é inválido. Volte para entrar e solicite outro.');
    }
  };
}
