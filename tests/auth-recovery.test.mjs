import test from 'node:test';
import assert from 'node:assert/strict';

test('password recovery sends the public return URL and preserves email', async () => {
  const { requestRecovery, APP_URL } = await import('../auth-recovery.mjs');
  let args;
  await requestRecovery({ resetPasswordForEmail: async (...a) => { args=a; return {error:null}; } }, ' person@example.com ');
  assert.deepEqual(args, ['person@example.com', {redirectTo: APP_URL}]);
  assert.equal(APP_URL, 'https://lkpb-pixel.github.io/redesigned-guide/');
});

test('weak or mismatched passwords never reach the authentication service', async () => {
  const { changeRecoveredPassword } = await import('../auth-recovery.mjs');
  let calls=0;
  const auth={updateUser:async()=>{calls++;return {error:null};}};
  await assert.rejects(()=>changeRecoveredPassword(auth,'short','short'), /10/);
  await assert.rejects(()=>changeRecoveredPassword(auth,'ExamplePass1!','DifferentPass1!'), /iguais/);
  assert.equal(calls,0);
});

test('password updates require a valid session and propagate expired-link errors', async () => {
  const { changeRecoveredPassword } = await import('../auth-recovery.mjs');
  let payload;
  await changeRecoveredPassword({updateUser:async p=>{payload=p;return {error:null};}},'ExamplePass1!','ExamplePass1!');
  assert.deepEqual(payload,{password:'ExamplePass1!'});
  await assert.rejects(()=>changeRecoveredPassword({updateUser:async()=>({error:new Error('Session expired')})},'ExamplePass1!','ExamplePass1!'), /Session expired/);
});

test('recovery links are recognized without treating normal sign-in as recovery', async () => {
  const { isRecoveryLink } = await import('../auth-recovery.mjs');
  assert.equal(isRecoveryLink('#access_token=test&type=recovery'),true);
  assert.equal(isRecoveryLink('#access_token=test&type=signup'),false);
  assert.equal(isRecoveryLink(''),false);
});

function recoveryPage(hash='') {
  const ids=['authScreen','appScreen','onboardingScreen','recoveryScreen','savePasswordBtn','authMsg','forgotPasswordBtn','emailInput','recoveryForm','newPasswordInput','confirmPasswordInput','passwordInput','recoveryMsg','cancelRecoveryBtn'];
  const elements=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',disabled:false,hidden:id!=='authScreen',classList:{toggle(name,value){elements[id].hidden=value;}},addEventListener(name,fn){this[name]=fn;},reset(){elements.newPasswordInput.value='';elements.confirmPasswordInput.value='';}}]));
  const stored=new Map();
  let listener;
  const calls=[];
  const session={user:{id:'test-user'}};
  const auth={onAuthStateChange(fn){listener=fn;},updateUser:async payload=>{calls.push(payload);return {error:null};},signOut:async()=>{listener('SIGNED_OUT',null);return {error:null};},resetPasswordForEmail:async()=>({error:null})};
  return {elements,stored,calls,auth,session,emit:(event,s=session)=>listener(event,s),options:{document:{getElementById:id=>elements[id]},location:{hash,pathname:'/redesigned-guide/',search:''},history:{replaceState(){}},storage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)}}};
}

test('recovery callback opens the password form before normal session initialization', async()=>{
  const {setupRecovery}=await import('../auth-recovery.mjs');
  const page=recoveryPage('#type=recovery&access_token=test');
  const controller=setupRecovery(page.auth,page.options);
  assert.equal(controller.active,true);
  assert.equal(page.elements.authScreen.hidden,true);
  assert.equal(page.elements.savePasswordBtn.disabled,true);
  page.emit('PASSWORD_RECOVERY');
  controller.acceptSession(page.session);
  assert.equal(page.elements.recoveryScreen.hidden,false);
  assert.equal(page.elements.savePasswordBtn.disabled,false);
  assert.equal(page.elements.appScreen.hidden,true);
  page.elements.newPasswordInput.value='ExamplePass1!';
  page.elements.confirmPasswordInput.value='ExamplePass1!';
  await page.elements.recoveryForm.submit({preventDefault(){}});
  assert.equal(page.calls.length,1);
  assert.equal(controller.active,false);
  assert.equal(page.elements.authScreen.hidden,false);
  assert.equal(page.elements.recoveryScreen.hidden,true);
  assert.match(page.elements.authMsg.textContent,/Senha atualizada/);
  assert.equal(page.stored.size,0);
});

test('expired recovery links cannot submit a password',async()=>{
  const {setupRecovery}=await import('../auth-recovery.mjs');
  const page=recoveryPage('#type=recovery');
  const controller=setupRecovery(page.auth,page.options);
  controller.acceptSession(null);
  await page.elements.recoveryForm.submit({preventDefault(){}});
  assert.equal(page.calls.length,0);
  assert.equal(page.elements.savePasswordBtn.disabled,true);
  assert.match(page.elements.recoveryMsg.textContent,/expirou/);
});

test('expired email verification returns a useful message and normal login remains available',async()=>{
  const {setupRecovery}=await import('../auth-recovery.mjs');
  const page=recoveryPage('#error=access_denied&error_code=otp_expired');
  const controller=setupRecovery(page.auth,page.options);
  controller.acceptSession(null);
  assert.equal(controller.active,false);
  assert.equal(page.elements.authScreen.hidden,false);
  assert.match(page.elements.authMsg.textContent,/Esqueci minha senha/);
});

test('refreshing the recovery page preserves the form for the existing recovery session',async()=>{
  const {setupRecovery}=await import('../auth-recovery.mjs');
  const page=recoveryPage();
  page.stored.set('controle-casal-password-recovery','1');
  const controller=setupRecovery(page.auth,page.options);
  controller.acceptSession(page.session);
  assert.equal(controller.active,true);
  assert.equal(page.elements.recoveryScreen.hidden,false);
  assert.equal(page.elements.savePasswordBtn.disabled,false);
});
