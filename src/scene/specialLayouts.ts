import type { Obstacle } from './diningSimulation.ts'
export type SpecialKind='crawford'|'engineering'|'academic'|'design1'|'design2'|'atrium'|'civil'|'soils'|'textile'|'architecture'
export type StationKind='microscope'|'computer'|'research'|'robot'|'electronics'|'mechanical'|'desk'|'study'|'cad'|'printer'|'prototype'|'cnc'|'laser'|'assembly'|'testing'|'storage'|'chess'|'sandwich'|'survey'|'structure'|'bridge'|'soil'|'sieve'|'press'|'sewing'|'loom'|'fabric'|'draft'|'model'|'materials'
export interface Station {x:number;z:number;kind:StationKind;label:string}
const s=(x:number,z:number,kind:StationKind,label:string):Station=>({x,z,kind,label})
export const specialStations:Record<SpecialKind,Station[]>={
 crawford:[s(-10,-8,'microscope','MICROSCOPY'),s(-6,-7,'research','SAMPLES'),s(5,-8,'research','MEASUREMENT'),s(9,-7,'computer','DATA'),s(-8,4,'study','RESEARCH TEAM'),s(6,4,'study','RESULTS'),s(11,8,'storage','SUPPLIES'),s(-11,7,'storage','SAMPLE CART'),s(-4.5,7,'research','SAMPLE PREP'),s(4.5,7,'microscope','OBSERVATION')],
 engineering:[s(-10,-7,'robot','ROBOTICS'),s(-6,-7,'computer','PROGRAMMING'),s(5,-7,'electronics','CIRCUITS'),s(9,-7,'electronics','SOLDERING'),s(-8,4,'mechanical','MECHANICAL'),s(7,4,'robot','ROBOT ASSEMBLY'),s(11,8,'storage','TOOLS'),s(-11,7,'storage','COMPONENTS'),s(-4.5,7,'electronics','SENSORS'),s(4.5,7,'robot','ROBOTICS')],
 academic:[...[-10,-7,-4].flatMap(x=>[-7,-4].map(z=>s(x,z,'desk','LECTURE'))),...[4,7,10].flatMap(x=>[-7,-4].map(z=>s(x,z,'computer','COMPUTER LAB'))),s(-8,4,'study','STUDENT LOUNGE'),s(7,4,'study','GROUP STUDY'),s(-4.5,7,'study','STUDY'),s(4.5,7,'study','STUDY')],
 design1:[s(-10,-7,'cad','CAD STUDIO'),s(-6,-7,'cad','MODELING'),s(-2,-7,'cad','DESIGN'),s(4,-7,'printer','3D PRINTING'),s(9,-7,'printer','PRINT FARM'),s(-8,4,'study','SKETCHES'),s(7,4,'prototype','PROTOTYPES'),s(11,8,'storage','MATERIALS'),s(-11,7,'storage','PARTS'),s(-4.5,7,'printer','PRINT PREP'),s(4.5,7,'prototype','PRINTED PARTS')],
 design2:[s(-10,-7,'assembly','ASSEMBLY'),s(-6,-7,'mechanical','PARTS'),s(5,-7,'cnc','CNC'),s(9,-7,'laser','LASER CUTTER'),s(-8,4,'prototype','SENIOR DESIGN'),s(7,4,'assembly','FABRICATION'),s(11,8,'storage','MATERIALS'),s(-11,7,'storage','PARTS'),s(-4.5,7,'cnc','MACHINING'),s(4.5,7,'assembly','ASSEMBLY')],
 atrium:[s(-10,-7,'desk','LECTURE'),s(-7,-7,'desk','LECTURE'),s(-4,-7,'desk','LECTURE'),s(4,-7,'computer','CODE'),s(7,-7,'computer','CODE'),s(10,-7,'computer','CODE'),s(-8,4,'sandwich','STACKS'),s(7,4,'chess','CHESS'),s(-4.5,7,'study','COLLABORATION'),s(4.5,7,'computer','PROGRAMMING')],
 civil:[s(-10,-7,'survey','SURVEYING'),s(-6,-7,'structure','LOAD TEST'),s(5,-7,'bridge','BRIDGE'),s(9,-7,'computer','DATA'),s(-8,4,'bridge','STRUCTURES'),s(7,4,'survey','FIELD EQUIPMENT'),s(-4.5,7,'structure','MATERIALS'),s(4.5,7,'cad','DESIGN')],
 soils:[s(-10,-7,'soil','SOIL SAMPLES'),s(-6,-7,'sieve','SIEVE ANALYSIS'),s(5,-7,'press','COMPRESSION'),s(9,-7,'computer','RESULTS'),s(-8,4,'soil','SAMPLE PREPARATION'),s(7,4,'sieve','GRAIN SIZE'),s(-4.5,7,'press','TESTING'),s(4.5,7,'soil','FIELD SAMPLES')],
 textile:[s(-10,-7,'sewing','SEWING'),s(-6,-7,'sewing','STITCHING'),s(5,-7,'loom','WEAVING'),s(9,-7,'fabric','TEXTILES'),s(-8,4,'fabric','CUTTING'),s(7,4,'loom','WEAVING'),s(-4.5,7,'sewing','PATTERNS'),s(4.5,7,'fabric','SWATCHES')],
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
}
export function specialWalls(kind:SpecialKind):Obstacle[]{return walls[kind]}
export function specialObstacles(kind:SpecialKind):Obstacle[]{
 const footprints=specialStations[kind].map(({x,z,kind:station}):Obstacle=>[x,z,station==='desk'||station==='computer'&&(kind==='academic'||kind==='atrium')?1.5:2.6,station==='desk'||station==='computer'&&(kind==='academic'||kind==='atrium')?1.1:1.5])
 return [...walls[kind],...footprints,...(kind==='engineering'||kind==='design2'?[[0,2.7,3.2,2] as Obstacle]:[]),...(kind==='academic'?[[-11,7,2,1.2],[11,7,2,1.2],[-12,-10,1,.8],[12,-10,1,.8]] as Obstacle[]:[])]
}
export const seatedStation=(kind:StationKind)=>['computer','desk','cad','study','chess','sewing','draft'].includes(kind)
