import assert from 'node:assert/strict'
import { campusStudentName } from '../src/life/campusNames.ts'
const names=new Set()
for(const kind of ['ambient','patio','indoor'])for(let i=0;i<100;i++){
 const name=campusStudentName(kind,i,'building:demo')
 assert(name&&name!=='Student');assert.equal(campusStudentName(kind,i,'building:demo'),name);names.add(name)
}
assert(names.size>30,'characters should have a variety of names')
assert.notEqual(campusStudentName('indoor',2,'building:one'),campusStudentName('indoor',2,'building:two'))
console.log('Campus characters receive varied, consistent names')
