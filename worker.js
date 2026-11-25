const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
export default {async fetch(request,env){
 if(request.method==="OPTIONS")return new Response(null,{headers:CORS});
 const u=new URL(request.url);
 if(u.pathname==="/")return new Response("NOVA AI API is online.",{headers:CORS});
 if(!env.OPENROUTER_API_KEY)return json({error:"Secret OPENROUTER_API_KEY manquant"},500);
 if(u.pathname==="/models"&&request.method==="GET"){
  const r=await fetch("https://openrouter.ai/api/v1/models",{headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`}});
  const d=await r.json();if(!r.ok)return json({error:"Chargement des modèles impossible"},r.status);
  return json({data:(d.data||[]).filter(m=>String(m.id).includes(":free")).map(m=>({id:m.id,name:m.name||m.id}))});
 }
 if(u.pathname==="/chat"&&request.method==="POST"){
  let b;try{b=await request.json()}catch{return json({error:"JSON invalide"},400)}
  if(!Array.isArray(b.messages)||!b.messages.length)return json({error:"Messages manquants"},400);
  const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,"Content-Type":"application/json","HTTP-Referer":"https://github.com/","X-Title":"NOVA AI"},body:JSON.stringify({model:b.model||"openrouter/auto",messages:b.messages.filter(m=>["user","assistant"].includes(m.role)&&typeof m.content==="string"),temperature:.7})});
  return json(await r.json(),r.status);
 }
 return json({error:"Route introuvable"},404);
}};
