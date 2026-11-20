import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {bathtubCourse,raceCoinPositions,collectRaceCoins} from '../src/activities/bathtubRace.ts'
const campus=JSON.parse(readFileSync(new URL('../public/campus.json',import.meta.url),'utf8')),course=bathtubCourse(campus),coins=raceCoinPositions(course)
assert.equal(coins.length,course.length*2)
const p=coins[0],firstLap=[],secondLap=[]
assert.deepEqual(collectRaceCoins(coins,firstLap,[p[0]-3,p[1]],[p[0]+3,p[1]]),[0],'sweeping across coin collects it')
assert.deepEqual(collectRaceCoins(coins,firstLap,[p[0]-3,p[1]],[p[0]+3,p[1]]),[],'coin cannot be collected twice in a lap')
assert.deepEqual(collectRaceCoins(coins,secondLap,[p[0]-3,p[1]],[p[0]+3,p[1]]),[0],'coin can be collected on second lap')
console.log('Owl coins appear along the course and collect once per lap')
