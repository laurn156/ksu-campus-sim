import type { Obstacle } from './diningSimulation.ts'
export type SpecialKind='crawford'|'engineering'|'academic'|'design1'|'design2'|'atrium'|'civil'|'soils'|'textile'|'architecture'|'competition'|'technology'|'housing'|'community'|'innovation'|'eventhall'|'activitycenter'
export type StationKind='microscope'|'computer'|'research'|'robot'|'electronics'|'mechanical'|'desk'|'study'|'cad'|'printer'|'prototype'|'cnc'|'laser'|'assembly'|'testing'|'storage'|'chess'|'sandwich'|'survey'|'structure'|'bridge'|'soil'|'sieve'|'press'|'sewing'|'loom'|'fabric'|'draft'|'model'|'materials'|'audience'|'drone'|'aircraft'|'rov'|'tank'|'plc'|'conveyor'|'reception'|'pcb'|'dressform'|'vexfield'|'combat'|'toolbench'|'vexbench'|'waiting'|'lockers'|'tv'|'foosball'|'wiring'|'careerbooth'|'researchposter'|'seniordesign'|'hand'|'humanoid'|'poolgame'|'pinggame'|'booth'
export interface Station {x:number;z:number;kind:StationKind;label:string}
const s=(x:number,z:number,kind:StationKind,label:string):Station=>({x,z,kind,label})
export const specialStations:Record<SpecialKind,Station[]>={
 crawford:[s(-10,-8,'microscope','MICROSCOPY'),s(-6,-7,'research','SAMPLES'),s(5,-8,'research','MEASUREMENT'),s(9,-7,'computer','DATA'),s(-8,4,'study','RESEARCH TEAM'),s(6,4,'study','RESULTS'),s(11,8,'storage','SUPPLIES'),s(-11,7,'storage','SAMPLE CART'),s(-4.5,7,'research','SAMPLE PREP'),s(4.5,7,'microscope','OBSERVATION')],
 engineering:[s(-10,-7,'robot','ROBOTICS'),s(-6,-7,'computer','PROGRAMMING'),s(5,-7,'electronics','CIRCUITS'),s(9,-7,'electronics','SOLDERING'),s(-8,4,'mechanical','MECHANICAL'),s(7,4,'drone','DRONE LAB'),s(11,8,'storage','TOOLS'),s(-11,7,'storage','COMPONENTS'),s(-4.5,7,'electronics','SENSORS'),s(4.5,7,'pcb','PCB DESIGN')],
 academic:[...[-10,-7,-4].flatMap(x=>[-7,-4].map(z=>s(x,z,'desk','LECTURE'))),...[4,7,10].flatMap(x=>[-7,-4].map(z=>s(x,z,'computer','COMPUTER LAB'))),s(-8,4,'study','STUDENT LOUNGE'),s(7,4,'study','GROUP STUDY'),s(-4.5,7,'study','STUDY'),s(4.5,7,'study','STUDY')],
 design1:[s(-10,-7,'draft','ARCHITECTURE STUDIO'),s(-6,-7,'model','SCALE MODELS'),s(-2,-7,'draft','DRAWING'),s(4,-7,'cad','CAD LAB'),s(9,-7,'cad','BUILDING DESIGN'),s(-8,4,'materials','CONSTRUCTION'),s(7,4,'model','JURY PRESENTATIONS'),s(-4.5,7,'study','ADVISING'),s(4.5,7,'draft','PROJECTS')],
 design2:[...[-10,-8,-6,6,8,10].flatMap(x=>[-7,-4].map(z=>s(x,z,'audience','AUDITORIUM'))),s(-8,4,'draft','ARCHITECTURE STUDIO'),s(7,4,'model','DESIGN MODELS'),s(-4.5,7,'cad','FACULTY OFFICE'),s(4.5,7,'study','OFFICE HOURS')],
 atrium:[s(-10,-7,'desk','LECTURE'),s(-7,-7,'desk','LECTURE'),s(-4,-7,'desk','LECTURE'),s(4,-7,'computer','CODE'),s(7,-7,'computer','CODE'),s(10,-7,'computer','CODE'),s(-8,4,'sandwich','STACKS'),s(7,4,'chess','CHESS'),s(-4.5,7,'study','COLLABORATION'),s(4.5,7,'computer','PROGRAMMING'),s(10.5,7.2,'chess','CHESS CLUB')],
 civil:[s(-10,-7,'survey','SURVEYING'),s(-6,-7,'structure','LOAD TEST'),s(5,-7,'bridge','BRIDGE'),s(9,-7,'computer','DATA'),s(-8,4,'press','CONCRETE TESTING'),s(7,4,'survey','FIELD EQUIPMENT'),s(-4.5,7,'materials','MATERIAL SAMPLES'),s(4.5,7,'cad','SITE DESIGN')],
 soils:[s(-10,-7,'soil','SOIL SAMPLES'),s(-6,-7,'sieve','SIEVE ANALYSIS'),s(5,-7,'press','COMPRESSION'),s(9,-7,'computer','RESULTS'),s(-8,4,'soil','SAMPLE PREPARATION'),s(7,4,'research','MOISTURE CONTENT'),s(-4.5,7,'survey','FIELD KIT'),s(4.5,7,'microscope','SOIL MICROSCOPY')],
 textile:[s(-10,-7,'sewing','SEWING'),s(-6,-7,'sewing','STITCHING'),s(5,-7,'loom','WEAVING'),s(9,-7,'fabric','TEXTILES'),s(-8,4,'draft','PATTERN CUTTING'),s(7,4,'dressform','DRESS FORMS'),s(-4.5,7,'sewing','EMBROIDERY'),s(4.5,7,'fabric','SWATCH LIBRARY')],
 competition:[s(-10,-7,'toolbench','TOOL BENCH'),s(-6,-7,'cad','VEHICLE DESIGN'),s(5,-7,'aircraft','AERIAL TEAM'),s(9,-7,'drone','FLIGHT TEST'),s(-8.5,4.6,'vexfield','VEX ROBOTICS'),s(7,4,'tank','UNDERWATER ROV'),s(-4.5,8,'vexbench','VEX BUILD'),s(9,8,'wiring','WIRING HARNESS')],
 technology:[s(-10,-7,'plc','PLC CONTROL'),s(-6,-7,'conveyor','AUTOMATION'),s(5,-7,'electronics','ELECTRONICS'),s(9,-7,'computer','INSTRUMENTATION'),s(-8,4,'cnc','CNC MACHINING'),s(7,4,'testing','METROLOGY'),s(-4.5,7,'robot','ROBOT CELL'),s(4.5,7,'printer','3D PRINTING')],
 housing:[s(-10,-7,'computer','RESIDENCE LIFE'),s(-6,-7,'computer','ROOM ASSIGNMENTS'),s(5,-7,'study','MEETING ROOM'),s(9,-7,'storage','RECORDS'),s(-8,4,'reception','FRONT DESK'),s(7,4,'study','APPOINTMENTS'),s(-6,8.2,'waiting','WAITING AREA'),s(4.5,8,'lockers','PACKAGE PICKUP')],
 community:[s(-10,-7,'study','STUDY TABLE'),s(-6,-7,'chess','BOARD GAMES'),s(5,-7,'foosball','FOOSBALL'),s(9,-7,'storage','EVENT SUPPLIES'),s(-7.5,3.4,'tv','TV LOUNGE'),s(7,4,'study','CRAFT TABLE'),s(-4.5,8.4,'study','STUDY NOOK'),s(4.5,7,'chess','GAMES')],
 innovation:[s(-10,-7,'humanoid','HUMANOID'),s(-6,-7,'hand','ROBOTIC HAND'),s(5,-7,'drone','DRONE RESEARCH'),s(9,-7,'robot','ROBOTIC ARM')],
 eventhall:[s(-10.5,-7,'careerbooth','OWLTECH SOFTWARE'),s(-6.5,-7,'careerbooth','PEACH STATE ENERGY'),s(-10.5,-1.5,'careerbooth','SKYLINE AEROSPACE'),s(-6.5,-1.5,'careerbooth','BUILDRIGHT CONSTRUCTION'),s(-1.8,-7,'researchposter','MATERIALS SCIENCE'),s(1.8,-7,'researchposter','MACHINE LEARNING'),s(-1.8,-1.5,'researchposter','RENEWABLE ENERGY'),s(1.8,-1.5,'researchposter','PUBLIC HEALTH'),s(6.5,-7,'seniordesign','AUTONOMOUS ROVER'),s(10.5,-7,'seniordesign','DELIVERY DRONE'),s(6.5,-1.5,'seniordesign','SMART PROSTHETIC'),s(10.5,-1.5,'seniordesign','SOLAR CART'),s(-4.5,7,'reception','EVENT CHECK-IN'),s(4.5,7,'study','JUDGES TABLE')],
 activitycenter:[s(-10,-7,'study','STUDY TABLE'),s(-6,-7,'chess','CHESS'),s(5,-7,'poolgame','POOL'),s(9,-7,'pinggame','PING PONG'),s(-7.5,3.4,'tv','TV LOUNGE'),s(7,4,'foosball','FOOSBALL'),s(4.5,8.4,'study','STUDY NOOK')],
 architecture:[s(-11,-7,'draft','STUDIO A'),s(-7.5,-7,'draft','STUDIO B'),s(-4,-7,'draft','STUDIO C'),s(5,-7,'cad','DIGITAL DESIGN'),s(9,-7,'laser','LASER CUTTER'),s(-8,4.5,'model','STUDIO PROJECTS'),s(7,4.5,'model','THESIS MODELS'),s(-4.5,8,'materials','MATERIAL LIBRARY'),s(4.5,8,'printer','3D PRINTING')],
}
// Divider openings form a central corridor between the front and rear sections.
const walls:Record<SpecialKind,Obstacle[]>={
 crawford:[[-8,-1,12,.25],[8,-1,12,.25]],
 engineering:[[-9,-1,10,.25],[9,-1,10,.25]],
 academic:[[-8,-1,12,.25],[8,-1,12,.25],[0,-7,.25,8]],
 design1:[[-9,-1,10,.25],[9,-1,10,.25]],
 design2:[[-9,-1,10,.25],[9,-1,10,.25]],
 atrium:[[-9,-1,10,.25],[9,-1,10,.25],[0,-7,.25,8]],
 civil:[[-9,-1,10,.25],[9,-1,10,.25]],
 soils:[[-8,-1,12,.25],[8,-1,12,.25]],
 textile:[[-9,-1,10,.25],[9,-1,10,.25]],
 architecture:[[-9,-1,10,.25],[9,-1,10,.25]],
 competition:[[-9,-1,10,.25],[9,-1,10,.25]], technology:[[-9,-1,10,.25],[9,-1,10,.25]], housing:[[-9,-1,10,.25],[9,-1,10,.25]], community:[[-9,-1,10,.25],[9,-1,10,.25]], innovation:[[-9,-1,10,.25],[9,-1,10,.25]], eventhall:[], activitycenter:[[-9,-1,10,.25],[9,-1,10,.25]],
}
export function specialWalls(kind:SpecialKind):Obstacle[]{return walls[kind]}
// Shore Innovation Center study lounge (front half): 4-seat tables, booths and vending machines.
export const innovationLounge={tables:[[-9,3],[-9,7.5],[-4.5,5.2],[4.5,5.2]] as [number,number][],booths:[[9,3],[9,7.5]] as [number,number][],vending:[[13.25,8.6],[13.25,9.75]] as [number,number][]}
export function specialObstacles(kind:SpecialKind):Obstacle[]{
 // Floor-standing set pieces (arenas, lounge sets, lockers) have their own footprints; seats stay walkable.
 const footprints=specialStations[kind].flatMap(({x,z,kind:station}):Obstacle[]=>{
  if(station==='audience')return []
  if(station==='vexfield')return [[x,z,3.6,3.6]]
  if(station==='combat')return [[x,z,3.2,3.2]]
  if(station==='waiting')return [[x,z+.6,2.6,.2]]
  if(station==='tv')return [[x,z,2.4,.6],[x,z+3,2.6,.3]]
  if(station==='lockers')return [[x,z,2.4,.7]]
  if(station==='foosball')return [[x,z,1.6,.9]]
  const compact=station==='desk'||station==='computer'&&(kind==='academic'||kind==='atrium')
  return [[x,z,compact?1.5:2.6,compact?1.1:1.5]]
 })
 const lounge:Obstacle[]=kind==='innovation'?[...innovationLounge.tables.map(([x,z]):Obstacle=>[x,z,2.6,1]),...innovationLounge.booths.flatMap(([x,z]):Obstacle[]=>[[x,z,2.2,.8],[x,z-1.3,2.4,.12],[x,z+1.3,2.4,.12]]),...innovationLounge.vending.map(([x,z]):Obstacle=>[x,z,.85,1])]:[]
 return [...walls[kind],...footprints,...lounge,...(kind==='architecture'?[[0,3.4,3.2,2.2] as Obstacle]:[]),[-12.9,-1.8,.8,.8],[12.9,-1.8,.8,.8],...(kind==='design2'?specialStations.design2.filter(s=>s.kind==='audience').map(({x,z}):Obstacle=>[x,z+.62,.8,.2]):[]),...(kind==='engineering'?[[0,2.7,3.2,2] as Obstacle]:[]),...((kind==='community'||kind==='housing'||kind==='activitycenter')?[[-11,7,2,1.2],[11,7,2,1.2]] as Obstacle[]:[]),...(kind==='innovation'?[[0,2.7,3.2,2]] as Obstacle[]:[]),...(kind==='competition'?[[0,3,3.7,1.9],[-13.15,8.6,.7,2]] as Obstacle[]:[]),...(kind==='design1'?[[-11,7,2,1.2],[11,7,2,1.2]] as Obstacle[]:[]),...(kind==='design2'?[[-3,-9.8,.9,.7]] as Obstacle[]:[]),...(kind==='academic'?[[-11,7,2,1.2],[11,7,2,1.2],[-12,-10,1,.8],[12,-10,1,.8]] as Obstacle[]:[])]
}
export const seatedStation=(kind:StationKind)=>['computer','desk','cad','study','chess','sewing','draft','audience','pcb','waiting','tv'].includes(kind)
