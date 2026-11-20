import type { Obstacle } from './diningSimulation.ts'
/** Walls and large furnishings used by both routing and the rendered rooms. */
export const academicDivider:Obstacle[]=[[-8,-1,12,.25],[8,-1,12,.25]]
export const adminObstacles:Obstacle[]=[...academicDivider,[-10,-7,2,1.3],[-5,-7,2,1.3],[7,-6,4,2],[-7,5,4,1.2],[7,6,3,1.3],[7,4,1.5,1.2],[-12,8,1.5,1.5],[4,7,1.5,1.5],[10,8,1.5,1.5]]
export const mathObstacles:Obstacle[]=[...academicDivider,[0,-7,.25,8],...[-10,-7,-4,4,7,10].flatMap(x=>[-7,-4].map(z=>[x,z,1.5,1.1] as Obstacle)),[-8,5,3,1.6],[7,5,3,1.6],[12,8,2,1.3],[-4.5,8,2.2,1],[4.5,8,2.2,1],[12,2,1,1]]
export const libraryObstacles:Obstacle[]=[[-8,-2,12,.25],[8,-2,12,.25],...[-10,-6,0,6,10].map(x=>[x,-9,1.8,1.2] as Obstacle),...[-8,0,8].map(x=>[x,-7.5,1.8,.8] as Obstacle),...[-11.8,11.8].flatMap(x=>[1,5].map(z=>[x,z,1.8,1.2] as Obstacle)),...[-9,-5,5,9].map(x=>[x,-5,2.5,1.8] as Obstacle),...[-8,0,8].map(x=>[x,3,2.5,1.8] as Obstacle),[-10,8,2,1.5],[10,8,2,1],[5,7,2.8,1.7],[-5,7,2.8,1.7]]
