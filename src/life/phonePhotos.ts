export type PhonePhoto={id:string;image:string;caption:string;created:number}
const KEY='nest-life-phone-photos-v1'
export function loadPhonePhotos():PhonePhoto[]{try{const photos=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(photos)?photos.filter((p):p is PhonePhoto=>!!p&&typeof p.id==='string'&&typeof p.image==='string'&&typeof p.caption==='string'&&typeof p.created==='number').slice(0,8):[]}catch{return []}}
export async function savePhonePhoto(image:string,caption:string):Promise<boolean>{
 try{
  const img=new Image();img.src=image;await img.decode();const canvas=document.createElement('canvas');canvas.width=600;canvas.height=Math.round(img.height*canvas.width/img.width);const context=canvas.getContext('2d');if(!context)return false;context.drawImage(img,0,0,canvas.width,canvas.height)
  const photo:PhonePhoto={id:globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`,image:canvas.toDataURL('image/jpeg',.75),caption,created:Date.now()}
  localStorage.setItem(KEY,JSON.stringify([photo,...loadPhonePhotos()].slice(0,8)));window.dispatchEvent(new Event('phone-photos-changed'));return true
 }catch{return false}
}
export function deletePhonePhoto(id:string){try{localStorage.setItem(KEY,JSON.stringify(loadPhonePhotos().filter(p=>p.id!==id)));window.dispatchEvent(new Event('phone-photos-changed'))}catch{/* Storage may be unavailable. */}}
