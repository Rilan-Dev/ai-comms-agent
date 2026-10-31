export type WorkItemSource={
 eventType:"email.received"|"email.action_required"|"whatsapp.received";
 sourceKey:string;title:string;description:string;contact:string|null;
};
export function deriveBusinessEvent(event:Record<string,unknown>):WorkItemSource|null{
 const type=event.eventType;
 if(type!=="email.received"&&type!=="email.action_required"&&type!=="whatsapp.received")return null;
 const key=typeof event.eventId==="string"&&event.eventId?event.eventId:
  typeof event.messageId==="string"&&event.messageId?event.messageId:"";
 if(!key||key.length>180)return null;
 const field=(v:unknown,max:number)=>typeof v==="string"?v.replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,max):"";
 const raw=field(event.subject,250)||field(event.body,250)||"New incoming "+(type==="whatsapp.received"?"WhatsApp request":"email enquiry");
 return {eventType:type,sourceKey:key,title:raw,description:field(event.snippet,2000)||field(event.body,2000),
 contact:field(event.from,240)||field(event.contactId,240)||null};
}
