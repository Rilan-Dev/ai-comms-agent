/** Fixed UTC text keeps the server render and browser hydration identical. */
export function formatWorkspaceTimestamp(value:string|null|undefined,dateOnly=false):string{
 if(!value)return 'No date';
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'No date';
 const iso=date.toISOString();return dateOnly?iso.slice(0,10):iso.slice(0,19).replace('T',' ')+' UTC';
}
