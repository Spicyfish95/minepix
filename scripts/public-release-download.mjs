export async function publicBytes(url,{
 fetcher=fetch,
 wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)),
 attempts=12,
}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  const request=new URL(url);
  request.searchParams.set('minepix_verify',`${Date.now()}-${attempt}`);
  const response=await fetcher(request.href,{headers:{'Cache-Control':'no-cache'}});
  if(response.ok)return Buffer.from(await response.arrayBuffer());
  if(response.status!==404||attempt===attempts-1)throw new Error(`Public asset ${response.status}: ${url}`);
  await wait(5000);
 }
}
