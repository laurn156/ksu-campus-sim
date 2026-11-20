import type { PaletteName } from '../characters/palette'
export type StudentId = 'imani'|'nico'|'tess'|'devon'|'marisol'|'jordan'|'riley'
export type StudentProfile = {
  id:StudentId; name:string; major:string; personality:string; likes:string[]; dislikes:string[]; background:string
  color:PaletteName; home:string; routine:{hour:number;code:string;label:string}[]; relationships:Partial<Record<StudentId,string>>
}
export const STUDENTS:StudentProfile[]=[
  {id:'jordan',name:'Jordan',major:'Computer Science',personality:'Resourceful, friendly, and persistent',likes:['programming','hackathons','debugging'],dislikes:['broken builds','lost work'],background:'Jordan is debugging a group coding project for an upcoming hackathon.',color:'slate',home:'J',routine:[{hour:8,code:'J',label:'computer science class'},{hour:12,code:'X',label:'lunch'},{hour:14,code:'J',label:'coding project'},{hour:17,code:'A',label:'meeting friends'}],relationships:{}},
  {id:'riley',name:'Riley',major:'Business',personality:'Good-natured Kennesaw campus fan who enjoys a friendly rivalry',likes:['Kennesaw campus','sports','friendly debates'],dislikes:['mean-spirited arguments'],background:'Riley is visiting the Marietta campus and likes making playful arguments that Kennesaw is better, while respecting both campuses.',color:'cream',home:'A',routine:[{hour:8,code:'A',label:'visiting campus'},{hour:12,code:'X',label:'lunch'},{hour:14,code:'S1',label:'recreation'},{hour:17,code:'A',label:'meeting friends'}],relationships:{}},
  {id:'imani',name:'Imani',major:'Mechatronics Engineering',personality:'Curious, inventive, and a little reserved',likes:['robotics','building','coffee'],dislikes:['rushing','being teased'],background:'Imani is building a small campus delivery robot with a student team.',color:'purple',home:'Q',routine:[{hour:8,code:'Q',label:'engineering class'},{hour:12,code:'X',label:'lunch'},{hour:14,code:'C',label:'studying'},{hour:16,code:'Q',label:'robotics project'},{hour:19,code:'A',label:'heading home'}],relationships:{nico:'friendly rival',tess:'club teammate'}},
  {id:'nico',name:'Nico',major:'Computer Game Design',personality:'Competitive, energetic, and good-natured',likes:['games','sports','challenges'],dislikes:['studying alone','insults'],background:'Nico is designing a game between pickup matches at the recreation center.',color:'orange',home:'S1',routine:[{hour:8,code:'H',label:'class'},{hour:12,code:'X',label:'lunch'},{hour:15,code:'S1',label:'recreation'},{hour:18,code:'A',label:'meeting friends'}],relationships:{imani:'friendly rival',devon:'study partner'}},
  {id:'tess',name:'Tess',major:'Architecture',personality:'Outgoing, imaginative, and welcoming',likes:['clubs','art','meeting people'],dislikes:['unfairness','being ignored'],background:'Tess is helping organize a student showcase for campus clubs.',color:'green',home:'N',routine:[{hour:8,code:'N',label:'studio'},{hour:12,code:'X',label:'lunch'},{hour:14,code:'A',label:'club planning'},{hour:17,code:'J',label:'meeting friends'}],relationships:{imani:'club teammate',marisol:'friend'}},
  {id:'devon',name:'Devon',major:'Mathematics',personality:'Thoughtful, organized, and quietly funny',likes:['books','puzzles','quiet'],dislikes:['noise','arguments'],background:'Devon is preparing for a difficult exam and trying to remember to take breaks.',color:'blue',home:'C',routine:[{hour:8,code:'D',label:'math class'},{hour:12,code:'X',label:'lunch'},{hour:14,code:'C',label:'studying'},{hour:17,code:'J',label:'taking a break'}],relationships:{nico:'study partner',marisol:'friend'}},
  {id:'marisol',name:'Marisol',major:'Media and Entertainment',personality:'Playful, observant, and quick with a joke',likes:['stories','music','comedy'],dislikes:['rudeness','boring meetings'],background:'Marisol collects funny campus stories for a student media project.',color:'yellow',home:'J',routine:[{hour:8,code:'T',label:'class'},{hour:12,code:'X',label:'lunch'},{hour:14,code:'J',label:'collecting stories'},{hour:17,code:'A',label:'hanging out'}],relationships:{tess:'friend',devon:'friend'}},
]
export function scheduleFor(student:StudentProfile,minute:number) {
  const hour=Math.floor(minute/60)
  return [...student.routine].reverse().find(item=>item.hour<=hour) ?? student.routine[0]
}


export function moodFor(student:StudentProfile,minute:number,score:number) {
  if(score <= -15)return 'guarded'
  if(minute>=18*60)return student.id==='devon'?'tired':'relaxed'
  if(student.id==='devon' && minute>=13*60 && minute<17*60)return 'focused'
  if(student.id==='imani' && minute>=14*60 && minute<17*60)return 'thoughtful'
  return student.id==='nico'?'energized':student.id==='marisol'?'playful':student.id==='tess'?'upbeat':'calm'
}
