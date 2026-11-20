import type { Obstacle } from './diningSimulation.ts'
export type SpecialKind='crawford'|'engineering'|'academic'|'design1'|'design2'|'atrium'|'civil'|'soils'|'textile'|'architecture'|'competition'|'technology'|'housing'|'community'
export type StationKind='microscope'|'computer'|'research'|'robot'|'electronics'|'mechanical'|'desk'|'study'|'cad'|'printer'|'prototype'|'cnc'|'laser'|'assembly'|'testing'|'storage'|'chess'|'sandwich'|'survey'|'structure'|'bridge'|'soil'|'sieve'|'press'|'sewing'|'loom'|'fabric'|'draft'|'model'|'materials'|'audience'|'drone'|'aircraft'|'rov'|'tank'|'plc'|'conveyor'|'reception'
export interface Station {x:number;z:number;kind:StationKind;label:string}
const s=(x:number,z:number,kind:StationKind,label:string):Station=>({x,z,kind,label})
export const specialStations:Record<SpecialKind,Station[]>={
 crawford:[s(-10,-8,'microscope','MICROSCOPY'),s(-6,-7,'research','SAMPLES'),s(5,-8,'research','MEASUREMENT'),s(9,-7,'computer','DATA'),s(-8,4,'study','RESEARCH TEAM'),s(6,4,'study','RESULTS'),s(11,8,'storage','SUPPLIES'),s(-11,7,'storage','SAMPLE CART'),s(-4.5,7,'research','SAMPLE PREP'),s(4.5,7,'microscope','OBSERVATION')],
 engineering:[s(-10,-7,'robot','ROBOTICS'),s(-6,-7,'computer','PROGRAMMING'),s(5,-7,'electronics','CIRCUITS'),s(9,-7,'electronics','SOLDERING'),s(-8,4,'mechanical','MECHANICAL'),s(7,4,'robot','ROBOT ASSEMBLY'),s(11,8,'storage','TOOLS'),s(-11,7,'storage','COMPONENTS'),s(-4.5,7,'electronics','SENSORS'),s(4.5,7,'robot','ROBOTICS')],
 academic:[...[-10,-7,-4].flatMap(x=>[-7,-4].map(z=>s(x,z,'desk','LECTURE'))),...[4,7,10].flatMap(x=>[-7,-4].map(z=>s(x,z,'computer','COMPUTER LAB'))),s(-8,4,'study','STUDENT LOUNGE'),s(7,4,'study','GROUP STUDY'),s(-4.5,7,'study','STUDY'),s(4.5,7,'study','STUDY')],
 design1:[s(-10,-7,'draft','ARCHITECTURE STUDIO'),s(-6,-7,'model','SCALE MODELS'),s(-2,-7,'draft','DRAWING'),s(4,-7,'cad','CAD LAB'),s(9,-7,'cad','BUILDING DESIGN'),s(-8,4,'materials','CONSTRUCTION'),s(7,4,'model','JURY PRESENTATIONS'),s(-4.5,7,'study','ADVISING'),s(4.5,7,'draft','PROJECTS')],
 design2:[...[-10,-8,-6,6,8,10].flatMap(x=>[-7,-4].map(z=>s(x,z,'audience','AUDITORIUM'))),s(-8,4,'draft','ARCHITECTURE STUDIO'),s(7,4,'model','DESIGN MODELS'),s(-4.5,7,'cad','FACULTY OFFICE'),s(4.5,7,'study','OFFICE HOURS')],
 atrium:[s(-10,-7,'desk','LECTURE'),s(-7,-7,'desk','LECTURE'),s(-4,-7,'desk','LECTURE'),s(4,-7,'computer','CODE'),s(7,-7,'computer','CODE'),s(10,-7,'computer','CODE'),s(-8,4,'sandwich','STACKS'),s(7,4,'chess','CHESS'),s(-4.5,7,'study','COLLABORATION'),s(4.5,7,'computer','PROGRAMMING')],
 civil:[s(-10,-7,'survey','SURVEYING'),s(-6,-7,'structure','LOAD TEST'),s(5,-7,'bridge','BRIDGE'),s(9,-7,'computer','DATA'),s(-8,4,'bridge','STRUCTURES'),s(7,4,'survey','FIELD EQUIPMENT'),s(-4.5,7,'structure','MATERIALS'),s(4.5,7,'cad','DESIGN')],
 soils:[s(-10,-7,'soil','SOIL SAMPLES'),s(-6,-7,'sieve','SIEVE ANALYSIS'),s(5,-7,'press','COMPRESSION'),s(9,-7,'computer','RESULTS'),s(-8,4,'soil','SAMPLE PREPARATION'),s(7,4,'sieve','GRAIN SIZE'),s(-4.5,7,'press','TESTING'),s(4.5,7,'soil','FIELD SAMPLES')],
 textile:[s(-10,-7,'sewing','SEWING'),s(-6,-7,'sewing','STITCHING'),s(5,-7,'loom','WEAVING'),s(9,-7,'fabric','TEXTILES'),s(-8,4,'fabric','CUTTING'),s(7,4,'loom','WEAVING'),s(-4.5,7,'sewing','PATTERNS'),s(4.5,7,'fabric','SWATCHES')],
 competition:[s(-10,-7,'mechanical','RACING'),s(-6,-7,'cad','VEHICLE DESIGN'),s(5,-7,'aircraft','AERIAL TEAM'),s(9,-7,'drone','FLIGHT TEST'),s(-8,4,'robot','ROBOTICS'),s(7,4,'tank','ROV TANK'),s(-4.5,7,'study','TEAM MEETING'),s(4.5,7,'rov','UNDERWATER ROBOTICS')],
 technology:[s(-10,-7,'plc','PLC CONTROL'),s(-6,-7,'conveyor','AUTOMATION'),s(5,-7,'electronics','ELECTRONICS'),s(9,-7,'computer','INSTRUMENTATION'),s(-8,4,'cnc','MANUFACTURING'),s(7,4,'mechanical','MEASUREMENT'),s(-4.5,7,'plc','INDUSTRIAL CONTROL'),s(4.5,7,'study','TECHNOLOGY CLASS')],
 housing:[s(-10,-7,'computer','STAFF OFFICE'),s(-6,-7,'computer','HOUSING SERVICES'),s(5,-7,'study','MEETING'),s(9,-7,'storage','RECORDS'),s(-8,4,'reception','RECEPTION'),s(7,4,'study','APPOINTMENTS'),s(-4.5,7,'study','WAITING'),s(4.5,7,'study','PAPERWORK')],
 community:[s(-10,-7,'study','STUDY TABLE'),s(-6,-7,'chess','BOARD GAMES'),s(5,-7,'study','GROUP ACTIVITIES'),s(9,-7,'storage','EVENT SUPPLIES'),s(-8,4,'study','LOUNGE'),s(7,4,'study','COMMUNITY TABLE'),s(-4.5,7,'study','STUDY'),s(4.5,7,'chess','GAMES')],
 architecture:[s(-10,-7,'draft','DRAFTING'),s(-6,-7,'draft','STUDIO'),s(5,-7,'cad','DIGITAL DESIGN'),s(9,-7,'model','MODELS'),s(-8,4,'model','STUDIO PROJECTS'),s(7,4,'materials','MATERIALS'),s(-4.5,7,'draft','DRAWING'),s(4.5,7,'model','MODEL MAKING')],
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
 competition:[[-9,-1,10,.25],[9,-1,10,.25]], technology:[[-9,-1,10,.25],[9,-1,10,.25]], housing:[[-9,-1,10,.25],[9,-1,10,.25]], community:[[-9,-1,10,.25],[9,-1,10,.25]],
}
export function specialWalls(kind:SpecialKind):Obstacle[]{return walls[kind]}
export function specialObstacles(kind:SpecialKind):Obstacle[]{
 const footprints=specialStations[kind].filter(({kind:station})=>station!=='audience').map(({x,z,kind:station}):Obstacle=>[x,z,station==='audience'?.75:station==='desk'||station==='computer'&&(kind==='academic'||kind==='atrium')?1.5:2.6,station==='audience'?.65:station==='desk'||station==='computer'&&(kind==='academic'||kind==='atrium')?1.1:1.5])
 return [...walls[kind],...footprints,[-12.9,-1.8,.8,.8],[12.9,-1.8,.8,.8],...(kind==='design2'?specialStations.design2.filter(s=>s.kind==='audience').map(({x,z}):Obstacle=>[x,z+.62,.8,.2]):[]),...(kind==='engineering'?[[0,2.7,3.2,2] as Obstacle]:[]),...((kind==='community'||kind==='housing')?[[-11,7,2,1.2],[11,7,2,1.2]] as Obstacle[]:[]),...(kind==='competition'?[[0,3,2.6,1.7]] as Obstacle[]:[]),...(kind==='design1'?[[-11,7,2,1.2],[11,7,2,1.2]] as Obstacle[]:[]),...(kind==='design2'?[[-3,-9.8,.9,.7]] as Obstacle[]:[]),...(kind==='academic'?[[-11,7,2,1.2],[11,7,2,1.2],[-12,-10,1,.8],[12,-10,1,.8]] as Obstacle[]:[])]
}
export const seatedStation=(kind:StationKind)=>['computer','desk','cad','study','chess','sewing','draft','audience'].includes(kind)
