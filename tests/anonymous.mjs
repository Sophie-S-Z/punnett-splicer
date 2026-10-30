import assert from 'node:assert/strict';
const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(base&&key,'Public Supabase configuration required');
for(const [name,body] of [
 ['page',{kind_input:'chains'}],['chain',{id_input:crypto.randomUUID()}],['mutate',{operation_input:'chain.create',payload_input:{name:'Denied'}}],['begin',{chain_input:crypto.randomUUID(),image_input:crypto.randomUUID(),request_input:crypto.randomUUID()}],['checkpoint',{run_input:crypto.randomUUID(),position_input:1,output_input:'Denied',duration_input:1}],['fail',{run_input:crypto.randomUUID(),error_input:'Denied'}]
]){const response=await fetch(`${base}/rest/v1/rpc/punnett_studio_${name}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,401,name);assert.equal((await response.json()).code,'42501',name);console.log(`PASS: anonymous ${name} denied`);}
const response=await fetch(`${base}/rest/v1/studio_chains?select=id&limit=1`,{headers:{apikey:key,'Accept-Profile':'punnett_private'}});assert.equal(response.status,406);console.log('PASS: private studio schema is not exposed');
