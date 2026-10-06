const FIELD_RANGES: readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]] = [[0,59],[0,23],[1,31],[1,12],[0,6]];

function expandField(field:string,min:number,max:number):Set<number>{
  const out=new Set<number>();
  for(const part of field.split(",")){
    const [base,stepRaw]=part.split("/"); const step=Number(stepRaw??1); if(!base) throw new Error("Invalid cron field");
    if(!Number.isInteger(step)||step<1) throw new Error("Invalid cron step");
    let start=min,end=max;
    if(base==="*"){ /* full range */ }
    else if(base.includes("-")){ const [a,b]=base.split("-").map(Number); if(!Number.isInteger(a)||!Number.isInteger(b)) throw new Error("Invalid cron range"); start=a; end=b; }
    else { const n=Number(base); if(!Number.isInteger(n)) throw new Error("Invalid cron value"); start=n; end=n; }
    if(start<min||end>max||start>end) throw new Error("Cron value out of range");
    for(let n=start;n<=end;n+=step) out.add(n);
  }
  return out;
}

export function matchesCron(cron:string,date:Date,timeZone:string):boolean{
  const fields=cron.trim().split(/\\s+/); if(fields.length!==5) throw new Error("Cron must contain five fields");
  const parts=new Intl.DateTimeFormat("en-US",{timeZone,hour12:false,minute:"numeric",hour:"numeric",day:"numeric",month:"numeric",weekday:"short"}).formatToParts(date);
  const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  const weekday=new Map([["Sun",0],["Mon",1],["Tue",2],["Wed",3],["Thu",4],["Fri",5],["Sat",6]]).get(parts.find(p=>p.type==="weekday")?.value??"Sun")??0;
  const values=[get("minute"),get("hour"),get("day"),get("month"),weekday];
  return fields.every((f,i)=>{ const range=FIELD_RANGES[i]!; return expandField(f,range[0],range[1]).has(values[i]!); });
}

export function nextCronFire(cron:string,after:Date,timeZone:string):Date{
  let candidate=new Date(after.getTime()); candidate.setUTCSeconds(0,0); candidate.setUTCMinutes(candidate.getUTCMinutes()+1);
  for(let i=0;i<366*24*60;i++){ if(matchesCron(cron,candidate,timeZone)) return candidate; candidate=new Date(candidate.getTime()+60_000); }
  throw new Error("Unable to find next cron fire within one year");
}
