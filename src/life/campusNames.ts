/** Deterministic names keep the same character recognizable during a demo. */
const names=['Aaliyah','Adrian','Alex','Amina','Amir','Andre','Ari','Ava','Bailey','Blake','Brianna','Caleb','Camila','Casey','Chloe','Chris','Darius','Diana','Elena','Eli','Emery','Emma','Evan','Fatima','Gabriel','Grace','Hannah','Isaiah','Jada','Jalen','Jasmine','Jayden','Kai','Kara','Kendall','Layla','Leah','Leo','Liam','Lina','Logan','Maya','Miles','Morgan','Naomi','Noah','Olivia','Omar','Parker','Priya','Quinn','Rae','Sam','Sarah','Sofia','Taylor','Theo','Valerie','Zara','Zion']
export function campusStudentName(kind:string,id:number,location='campus'):string{
 const key=kind+':'+location+':'+id;let hash=2166136261
 for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return names[(hash>>>0)%names.length]
}
