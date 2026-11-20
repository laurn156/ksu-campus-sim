import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isCampusBuilding, loadCampus } from '../src/campus.ts'
import { groupResidenceLocations } from '../src/ui/locationGroups.ts'
const {buildings}=JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8'))
const originalFetch=globalThis.fetch
globalThis.fetch=async()=>({json:async()=>JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8'))})
const loaded=await loadCampus()
globalThis.fetch=originalFetch
const hub=loaded.buildings.find(b=>b.id==='1504299650')
assert(hub && isCampusBuilding(hub) && hub.short==='Hornet Hub' && hub.code==='','Hornet Hub must be labeled and selectable')
const {singles,grouped}=groupResidenceLocations(buildings.filter(isCampusBuilding))
for(const label of ['University Columns','Courtyard','Commons','Hornet Village']){
 assert.equal(grouped.filter(g=>g.label===label).length,1,`${label} should have one destination`)
 assert(grouped.find(g=>g.label===label).building.poly.length>=3,`${label} needs a real representative building`)
}
assert(singles.some(b=>b.name==='University Columns Activity Center'),'activity center should remain a separate destination')
assert(singles.some(b=>b.code==='R1')&&singles.some(b=>b.code==='R2'),'Howell and Norton should remain separate')
assert(!singles.some(b=>/university columns \d+$|courtyard \d+$|commons \d+$|hornet village \d+$/i.test(b.short||b.name)),'numbered residences should be grouped')
console.log('Residential destinations are grouped; named facilities and residence halls remain selectable.')
